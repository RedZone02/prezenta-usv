'use client'
import { useState, useEffect, useCallback } from 'react'
import styles from './page.module.css'
import { createClientBrowser } from '../lib/supabase/client'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { getSaptamana } from '../lib/date'
import FraudAlert from '../componente/FraudAlert'

/* TIPURI DATE */
type Loc = {
    id: number
    numar: number
    ocupat: boolean
    rezervat: boolean
    defect?: boolean
    room_id: string
    student_id: string | null
    profiles?: { full_name: string } | null
}

type Student = {
    id: string
    full_name: string
    student_number?: string
    grupa?: string
    scanned_at?: string | null
}

type OrarCurent = {
    id: string
    materie: string
    grupa: string
    specializare: string
    ora_start: string
    ora_end: string
} | null

type Tab = 'sala' | 'prezenti' | 'statistici'

/* UTILS */
function getOraSiZiBucuresti() {
    const acum = new Date()
    const bucuresti = new Date(acum.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }))
    const ziAzi = bucuresti.getDay() === 0 ? 7 : bucuresti.getDay()
    const ora = String(bucuresti.getHours()).padStart(2, '0')
    const min = String(bucuresti.getMinutes()).padStart(2, '0')
    return { ziAzi, oraAzi: `${ora}:${min}:00` }
}

/* COMPONENTA PRINCIPALA */
export default function ProfesorPage() {
    const supabase = createClientBrowser()
    const router = useRouter()

    const [tabActiv, setTabActiv] = useState<Tab>('sala')
    const [modalLoc, setModalLoc] = useState<Loc | null>(null)
    const [loading, setLoading] = useState(true)
    const [exportLoading, setExportLoading] = useState(false)
    const [numeProfesor, setNumeProfesor] = useState<string>('')
    const [locuri, setLocuri] = useState<Loc[]>([])
    const [studenti, setStudenti] = useState<Student[]>([])
    const [orarCurent, setOrarCurent] = useState<OrarCurent>(null)
    const [scheduleId, setScheduleId] = useState<string | null>(null)
    const [attendanceIds, setAttendanceIds] = useState<Set<string>>(new Set())
    const [oreScanare, setOreScanare] = useState<Record<string, string>>({})
    const [persoaneSenzor, setPersoaneSenzor] = useState<number>(0)
    const ROOM_ID = 'c101'

    /* Autentificare */
    useEffect(() => {
        async function fetchProfil() {
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) return router.push('/login')

            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, role')
                .eq('id', user.id)
                .single()

            if (error || !data || data.role !== 'profesor') return router.push('/login')
            setNumeProfesor(data.full_name)
        }
        fetchProfil()
    }, [supabase, router])

    /* ✅ NOU: fetchDateCurs extras ca useCallback */
    const fetchDateCurs = useCallback(async () => {
        const { ziAzi, oraAzi } = getOraSiZiBucuresti()
        const saptamana = getSaptamana()

        const { data: orarData } = await supabase
            .from('schedule')
            .select('id, materie, grupa, ora_start, ora_end, specializare')
            .eq('room_id', ROOM_ID)
            .eq('zi', ziAzi)
            .lte('ora_start', oraAzi)
            .gte('ora_end', oraAzi)
            .or(`saptamana.is.null,saptamana.eq.${saptamana}`)
            .maybeSingle()

        if (!orarData) {
            setOrarCurent(null)
            setStudenti([])
            setScheduleId(null)
            return
        }

        if (orarData.materie === 'PAUZA') {
            setOrarCurent({ ...orarData, materie: '☕ Pauză' })
            setStudenti([])
            setScheduleId(null)
            return
        }

        setOrarCurent(orarData)

        // ✅ Evităm re-fetch attendance dacă e același curs
        setScheduleId(prev => {
            if (prev === orarData.id) return prev
            return orarData.id
        })

        const [resStudenti, resPrezente] = await Promise.all([
            supabase.from('profiles')
                .select('id, full_name, nr_matricol, grupa, specializare')
                .eq('grupa', orarData.grupa)
                .eq('role', 'student')
                .order('full_name'),
            supabase.from('attendance')
                .select('student_id, scanned_at')
                .eq('schedule_id', orarData.id)
        ])

        if (resStudenti.data) {
            setStudenti(resStudenti.data.map((p: any) => ({
                id: p.id,
                full_name: p.full_name,
                student_number: p.nr_matricol ?? '—',
                grupa: p.grupa ?? orarData.grupa,
            })))
            setOrarCurent({
                ...orarData,
                specializare: resStudenti.data[0]?.specializare ?? 'Nespecificat'
            })
        }

        if (resPrezente.data) {
            setAttendanceIds(new Set(resPrezente.data.map((s: any) => s.student_id)))
            const ore: Record<string, string> = {}
            resPrezente.data.forEach((s: any) => { ore[s.student_id] = s.scanned_at })
            setOreScanare(ore)
        }
    }, [supabase])

    /* Locuri + Realtime sală + Realtime senzori + Realtime schedule */
    useEffect(() => {
        async function fetchLocuri() {
            const { data, error } = await supabase
                .from('room_seats')
                .select('*, profiles(full_name)')
                .eq('room_id', ROOM_ID)
                .order('numar')

            if (!error && data) setLocuri(data)
            setLoading(false)
        }
        fetchLocuri()

        async function fetchSenzori() {
            const { data } = await supabase.from('rooms').select('persoane_prezente').eq('id', ROOM_ID).single()
            if (data) setPersoaneSenzor(data.persoane_prezente || 0)
        }
        fetchSenzori()

        const channelSenzori = supabase
            .channel(`profesor-senzori-${ROOM_ID}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${ROOM_ID}` },
                (payload: any) => { setPersoaneSenzor(payload.new.persoane_prezente) }
            )
            .subscribe()

        const channelSala = supabase
            .channel(`profesor-room-${ROOM_ID}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'room_seats', filter: `room_id=eq.${ROOM_ID}` },
                () => { fetchLocuri() }
            )
            .subscribe()

        // ✅ NOU: Realtime pe schedule — dacă orarul se schimbă în DB, re-fetch instant
        const channelSchedule = supabase
            .channel(`profesor-schedule-${ROOM_ID}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'schedule', filter: `room_id=eq.${ROOM_ID}` },
                () => { fetchDateCurs() }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channelSala)
            supabase.removeChannel(channelSenzori)
            supabase.removeChannel(channelSchedule)
        }
    }, [supabase, fetchDateCurs])

    /* ✅ NOU: Polling la 60s + fetch inițial pentru orar/studenți */
    useEffect(() => {
        fetchDateCurs()
        const interval = setInterval(fetchDateCurs, 60_000)
        return () => clearInterval(interval)
    }, [fetchDateCurs])

    /* Realtime Attendance (RFID) */
    useEffect(() => {
        if (!scheduleId) return

        const channelAttendance = supabase
            .channel(`attendance-rfid-${scheduleId}`)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'attendance', filter: `schedule_id=eq.${scheduleId}` },
                (payload: any) => {
                    setAttendanceIds(prev => new Set([...prev, payload.new.student_id]))
                    setOreScanare(prev => ({
                        ...prev,
                        [payload.new.student_id]: new Date(payload.new.scanned_at).toISOString(),
                    }))
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channelAttendance) }
    }, [supabase, scheduleId])

    /* INTERACȚIUNI */
    function handleClickLoc(loc: Loc) {
        if (loc.defect) {
            const confirm = window.confirm(`PC-ul de la locul ${loc.numar} este marcat ca DEFECT. Doriți să îl marcați ca fiind funcțional?`)
            if (confirm) toggleDefectLoc(loc.id, true)
            return
        }
        if (loc.ocupat && loc.student_id) {
            eliminaStudent(loc.student_id)
        } else {
            setModalLoc(loc)
        }
    }

    async function toggleDefectLoc(locId: number, currentDefectStatus: boolean) {
        const { error } = await supabase
            .from('room_seats')
            .update({ defect: !currentDefectStatus })
            .eq('id', locId)

        if (error) alert('Eroare la actualizarea statusului: ' + error.message)
        else setModalLoc(null)
    }

    async function eliminaStudent(studentId: string) {
        if (!scheduleId) return

        const locStudent = locuri.find(l => l.ocupat && l.student_id === studentId)
        if (locStudent) {
            const { error } = await supabase
                .from('room_seats')
                .update({ ocupat: false, rezervat: false, student_id: null })
                .eq('id', locStudent.id)
            if (error) return console.error('Eroare eliberare scaun:', error.message)
        }

        const { error } = await supabase
            .from('attendance')
            .delete()
            .eq('student_id', studentId)
            .eq('schedule_id', scheduleId)

        if (error) return console.error('Eroare stergere prezenta:', error.message)

        setAttendanceIds(prev => { const next = new Set(prev); next.delete(studentId); return next })
        setOreScanare(prev => { const next = { ...prev }; delete next[studentId]; return next })
    }

    async function asigneazaStudent(studentId: string) {
        if (!modalLoc || !scheduleId) return

        const { error: errSeat } = await supabase
            .from('room_seats')
            .update({ ocupat: true, student_id: studentId })
            .eq('id', modalLoc.id)

        if (errSeat) return console.error(errSeat.message)

        const { data: existing } = await supabase
            .from('attendance')
            .select('id, scanned_at')
            .eq('student_id', studentId)
            .eq('schedule_id', scheduleId)
            .maybeSingle()

        const oraScanareVal = existing ? existing.scanned_at : new Date().toISOString()

        if (!existing) {
            await supabase.from('attendance').insert({
                student_id: studentId,
                schedule_id: scheduleId,
                room_id: ROOM_ID,
                scanned_at: oraScanareVal,
                uid_used: 'manual',
            })
        }

        setOreScanare(prev => ({ ...prev, [studentId]: new Date(oraScanareVal).toISOString() }))
        setAttendanceIds(prev => new Set([...prev, studentId]))
        setModalLoc(null)
    }

    async function handleExportExcel() {
        if (!orarCurent) return
        setExportLoading(true)
        try {
            const randuri = studenti.map(s => ({
                'Nr. Matricol': s.student_number ?? '—',
                'Nume Student': s.full_name,
                'Grupă': s.grupa ?? '—',
                'Ora intrării': oreScanare[s.id]
                    ? new Date(oreScanare[s.id]).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
                    : '—',
                'Prezent': prezentiIds.has(s.id) ? 'Prezent(ă)' : 'Absent(ă)',
            }))

            const ws = XLSX.utils.json_to_sheet(randuri)
            ws['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Prezenta')
            XLSX.writeFile(wb, `Prezenta_${orarCurent.materie.replace(/[^a-zA-Z0-9 ]/g, '')}_${new Date().toLocaleDateString('ro-RO')}.xlsx`)
        } finally {
            setExportLoading(false)
        }
    }

    async function handleDeconectare() {
        await supabase.auth.signOut()
        router.push('/')
    }

    /* STĂRI DERIVATE */
    const prezentiIds = new Set([
        ...locuri.filter(l => l.ocupat && l.student_id).map(l => l.student_id as string),
        ...attendanceIds,
    ])
    const nrPrezentiTotal = studenti.filter(s => prezentiIds.has(s.id)).length
    const locuriDefecte = locuri.filter(l => l.defect).length
    const libere = locuri.filter(l => !l.ocupat && !l.defect)
    const procent = studenti.length > 0 ? Math.round((nrPrezentiTotal / studenti.length) * 100) : 0

    if (loading) return (
        <div className={styles.main}>
            <p style={{ padding: '2rem' }}>Se încarcă...</p>
        </div>
    )

    return (
        <div className={styles.main}>
            <header className={styles.header}>
                <div className={styles.headerStanga}>
                    <h1 className={styles.headerTitlu}>Sistem Prezență USV</h1>
                    <span className={styles.headerBadge}>Profesor</span>
                </div>
                <div className={styles.headerDreapta}>
                    {numeProfesor && <span className={styles.numeProfesor}>👤 {numeProfesor}</span>}
                    <button className={styles.butonDeconectare} onClick={handleDeconectare}>Deconectare</button>
                </div>
            </header>

            <div className={styles.container}>
                {/* Banner orar curent */}
                {orarCurent ? (
                    <div className={styles.orarBanner}>
                        <span>🎓 Specializare: <strong>{orarCurent.specializare}</strong></span>
                        <span>|  Grupa: <strong>{orarCurent.grupa}</strong></span>
                        <span>| 🕐 {orarCurent.ora_start.slice(0, 5)} – {orarCurent.ora_end.slice(0, 5)}</span>
                        <span>| 📅 Săpt. <strong>{getSaptamana()}</strong></span>
                    </div>
                ) : (
                    <div className={styles.orarBannerGol}>Nicio oră în desfășurare momentan</div>
                )}

                <div className={styles.infoBar}>
                    {[
                        { label: 'Ora', value: orarCurent?.materie ?? '—' },
                        { label: 'Sală', value: ROOM_ID.toUpperCase() },
                        { label: 'Prezenți', value: nrPrezentiTotal, cls: styles.verde },
                        { label: 'Absenți', value: libere.length, cls: styles.rosu },
                        { label: 'Locuri nefuncționale', value: locuriDefecte, cls: styles.portocaliu },
                        { label: 'Trecuți prin ușă', value: `🚶 ${persoaneSenzor}`, cls: styles.portocaliu },
                    ].map(({ label, value, cls }) => (
                        <div key={label} className={styles.infoBarItem}>
                            <span className={styles.infoBarLabel}>{label}</span>
                            <span className={`${styles.infoBarValue} ${cls ?? ''}`}>{value}</span>
                        </div>
                    ))}
                </div>

                <FraudAlert
                    studentiScanati={nrPrezentiTotal}
                    persoaneFizice={persoaneSenzor}
                />

                <div className={styles.tabs}>
                    {([
                        { key: 'sala', label: '🪑 Vizualizare Sală' },
                        { key: 'prezenti', label: `👥 Prezenți (${nrPrezentiTotal})` },
                        { key: 'statistici', label: '📊 Statistici' },
                    ] as const).map(t => (
                        <button
                            key={t.key}
                            className={`${styles.tab} ${tabActiv === t.key ? styles.tabActiv : ''}`}
                            onClick={() => setTabActiv(t.key)}
                        >{t.label}</button>
                    ))}
                </div>

                {/* TAB SALĂ */}
                {tabActiv === 'sala' && (
                    <div className={styles.card}>
                        <p className={styles.cardHint}>Click pe un loc pentru a-l elibera, asocia un student sau a raporta un defect.</p>
                        <div className={styles.tabla}>TABLĂ</div>
                        <div className={styles.gridLocuri}>
                            {[...locuri].sort((a, b) => a.numar - b.numar).map(loc => (
                                <button
                                    key={loc.id}
                                    // Logica de combinare a claselor (Defect are prioritate peste Liber, dar Ocupat are teoretic prioritate, desi un loc ocupat nu prea e defect)
                                    className={`${styles.loc} ${loc.defect ? styles.locDefect : (loc.ocupat ? styles.locOcupat : styles.locLiber)}`}
                                    onClick={() => handleClickLoc(loc)}
                                    title={loc.defect ? 'Defect — click pentru a marca ca reparat' : (loc.ocupat ? 'Ocupat — click pentru eliminare' : 'Liber — click pentru asignare')}
                                >
                                    <span className={styles.locLabel}>loc</span>
                                    <span className={styles.locNr}>{loc.numar}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB PREZENȚI */}
                {tabActiv === 'prezenti' && (
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitlu}>Studenți înscriși — {studenti.length} total</h2>
                            <button
                                className={styles.butonExport}
                                onClick={handleExportExcel}
                                disabled={exportLoading || !orarCurent || studenti.length === 0}
                            >
                                {exportLoading ? '⏳ Se exportă...' : '📥 Export Excel'}
                            </button>
                        </div>

                        {studenti.length === 0 ? (
                            <p className={styles.gol}>Nu există studenți la această oră.</p>
                        ) : (
                            <table className={styles.tabel}>
                                <thead>
                                    <tr>
                                        <th>Nr. Matricol</th>
                                        <th>Nume student</th>
                                        <th>Grupă</th>
                                        <th>Status</th>
                                        <th>Ora scanării</th>
                                        <th>Acțiuni</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studenti.map(s => {
                                        const estePrezent = prezentiIds.has(s.id)
                                        return (
                                            <tr key={s.id}>
                                                <td>{s.student_number}</td>
                                                <td>{s.full_name}</td>
                                                <td>{s.grupa}</td>
                                                <td>
                                                    <span className={estePrezent ? styles.badgePrezent : styles.badgeAbsent}>
                                                        {estePrezent ? '🟢 Prezent' : '🔴 Absent'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {oreScanare[s.id]
                                                        ? new Date(oreScanare[s.id]).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
                                                        : '—'
                                                    }
                                                </td>
                                                <td>
                                                    {estePrezent && (
                                                        <button className={styles.butonElimina} onClick={() => eliminaStudent(s.id)}>
                                                            Eliberează
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* TAB STATISTICI */}
                {tabActiv === 'statistici' && (
                    <div className={styles.statisticiWrap}>
                        <div className={styles.statisticiGrid}>
                            {[
                                { nr: nrPrezentiTotal, label: 'Prezenți', cls: styles.statVerde },
                                { nr: studenti.length - nrPrezentiTotal, label: 'Absenți', cls: styles.statRosu },
                                { nr: studenti.length, label: 'Total înscriși', cls: styles.statAlbastru },
                                { nr: `${procent}%`, label: 'Grad ocupare', cls: styles.statPortocaliu },
                            ].map(({ nr, label, cls }) => (
                                <div key={label} className={`${styles.statCard} ${cls}`}>
                                    <span className={styles.statNr}>{nr}</span>
                                    <span className={styles.statLabel}>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* MODAL SELECTARE STUDENT & MARCARE DEFECT */}
                {modalLoc && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div className={styles.card} style={{ width: '400px', maxHeight: '80vh', overflow: 'auto' }}>
                            <h3 className={styles.cardTitlu}>Locul {modalLoc.numar}</h3>

                            {/* Buton marcare defect */}
                            <button
                                className={styles.butonDefect}
                                onClick={() => toggleDefectLoc(modalLoc.id, false)}
                                style={{ width: '100%', marginBottom: '1rem' }}
                            >
                                ⚠️ Marchează PC-ul ca DEFECT
                            </button>

                            <hr style={{ margin: '1rem 0', borderColor: '#f3f4f6' }} />

                            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#4b5563' }}>Sau asignează manual un student:</h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {studenti.map(s => {
                                    const areLocOcupat = locuri.some(l => l.ocupat && l.student_id === s.id)
                                    return (
                                        <button
                                            key={s.id}
                                            className={styles.butonStudent}
                                            onClick={() => !areLocOcupat && asigneazaStudent(s.id)}
                                            disabled={areLocOcupat}
                                            style={{ opacity: areLocOcupat ? 0.4 : 1, cursor: areLocOcupat ? 'not-allowed' : 'pointer' }}
                                        >
                                            {areLocOcupat ? '✅' : '👤'} {s.full_name}
                                        </button>
                                    )
                                })}
                            </div>
                            <button className={styles.butonElimina} style={{ marginTop: '1rem', width: '100%' }} onClick={() => setModalLoc(null)}>
                                Anulează
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}