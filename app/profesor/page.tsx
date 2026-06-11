'use client'
import { useState, useEffect } from 'react'
import styles from './page.module.css'
import { createClientBrowser } from '../lib/supabase/client'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { getSaptamana } from '../lib/date'


type Loc = {
    id: number
    numar: number
    ocupat: boolean
    rezervat: boolean
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
    ora_start: string
    ora_end: string
} | null


type Tab = 'sala' | 'prezenti' | 'statistici'



export default function ProfesorPage() {
    const supabase = createClientBrowser()
    const router = useRouter()
    const [tabActiv, setTabActiv] = useState<Tab>('sala')
    const [locuri, setLocuri] = useState<Loc[]>([])
    const [loading, setLoading] = useState(true)
    const [studenti, setStudenti] = useState<Student[]>([])
    const [orarCurent, setOrarCurent] = useState<OrarCurent>(null)
    const [numeProfesor, setNumeProfesor] = useState<string>('')
    const [modalLoc, setModalLoc] = useState<Loc | null>(null)
    const [exportLoading, setExportLoading] = useState(false)
    const [attendanceIds, setAttendanceIds] = useState<Set<string>>(new Set())
    const [scheduleId, setScheduleId] = useState<string | null>(null)
    const [oreScanare, setOreScanare] = useState<Record<string, string>>({})
    const ROOM_ID = 'c101'


    // Încarcă numele profesorului logat si verificare dacă este profesor
    useEffect(() => {
        async function fetchProfil() {
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) {
                router.push('/login')
                return
            }
            const { data } = await supabase
                .from('profiles')
                .select('full_name, role')
                .eq('id', user.id)
                .single()


            if (!data || data.role !== 'profesor') {
                router.push('/login')
                return
            }
            setNumeProfesor(data.full_name)
        }
        fetchProfil()
    }, [])


    // Încarcă locurile
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
    }, [])


    // Realtime room_seats + attendance
    useEffect(() => {
        async function fetchLocuri() {
            const { data, error } = await supabase
                .from('room_seats')
                .select('*, profiles(full_name)')
                .eq('room_id', ROOM_ID)
                .order('numar')
            if (!error && data) setLocuri(data)
        }

        const channelSala = supabase
            .channel(`profesor-room-${Date.now()}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'room_seats' },
                () => { fetchLocuri() }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channelSala)
        }
    }, [])

    useEffect(() => {
        if (!scheduleId) return

        const channelAttendance = supabase
            .channel(`attendance-rfid-${scheduleId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'attendance',
                    filter: `schedule_id=eq.${scheduleId}`,
                },
                (payload: { new: { student_id: string; scanned_at: string } }) => {
                    setAttendanceIds(prev => new Set([...prev, payload.new.student_id]))
                    setOreScanare(prev => ({
                        ...prev,
                        [payload.new.student_id]: new Date(payload.new.scanned_at).toISOString(),
                    }))
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channelAttendance)
        }
    }, [scheduleId])


    // Studenți + orar curent + scanări RFID
    useEffect(() => {
        async function fetchStudentiOraActuala() {
            const acum = new Date()
            const bucuresti = new Date(acum.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }))
            const ziAzi = bucuresti.getDay() === 0 ? 7 : bucuresti.getDay()
            const ora = String(bucuresti.getHours()).padStart(2, '0')
            const min = String(bucuresti.getMinutes()).padStart(2, '0')
            const oraAzi = `${ora}:${min}:00`
            const saptamana = getSaptamana()


            const { data: orarData } = await supabase
                .from('schedule')
                .select('id, materie, grupa, ora_start, ora_end')
                .eq('room_id', ROOM_ID)
                .eq('zi', ziAzi)
                .lte('ora_start', oraAzi)
                .gte('ora_end', oraAzi)
                .or(`saptamana.is.null,saptamana.eq.${saptamana}`)
                .single()


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
            setScheduleId(orarData.id)


            // Studenți înscriși
            const { data: studentiData } = await supabase
                .from('profiles')
                .select('id, full_name, nr_matricol, grupa')
                .eq('grupa', orarData.grupa)
                .eq('role', 'student')
                .order('full_name')


            if (studentiData) {
                const lista = studentiData.map((p: any) => ({
                    id: p.id,
                    full_name: p.full_name,
                    student_number: p.nr_matricol ?? '—',
                    grupa: p.grupa ?? orarData.grupa,
                }))
                setStudenti(lista)
            }

            // Scanări RFID pentru ora curentă
            const { data: scanari } = await supabase
                .from('attendance')
                .select('student_id, scanned_at')
                .eq('schedule_id', orarData.id)

            if (scanari) {
                setAttendanceIds(new Set(scanari.map((s: any) => s.student_id)))
                // Salvează ora scanării per student
                const oreScanare: Record<string, string> = {}
                scanari.forEach((s: any) => { oreScanare[s.student_id] = s.scanned_at })
                setOreScanare(oreScanare)
            }


        }
        fetchStudentiOraActuala()
    }, [])


    function handleClickLoc(loc: Loc) {
        if (loc.ocupat) {
            elibereazaLoc(loc)
        } else {
            setModalLoc(loc)
        }
    }


    async function elibereazaLoc(loc: Loc) {
        await supabase
            .from('room_seats')
            .update({ ocupat: false, rezervat: false, student_id: null })
            .eq('id', loc.id)
    }


    async function asigneazaStudent(studentId: string) {
        console.log('scheduleId:', scheduleId)
        if (!modalLoc || !scheduleId) return

        // Marchează locul în sală
        await supabase
            .from('room_seats')
            .update({ ocupat: true, student_id: studentId })
            .eq('id', modalLoc.id)

        // Inserează în attendance dacă nu există deja
        const { data: existing } = await supabase
            .from('attendance')
            .select('id, scanned_at')
            .eq('student_id', studentId)
            .eq('schedule_id', scheduleId)
            .maybeSingle()

        if (!existing) {
            const oraScanare = new Date().toISOString()
            await supabase
                .from('attendance')
                .insert({
                    student_id: studentId,
                    schedule_id: scheduleId,
                    room_id: ROOM_ID,
                    scanned_at: oraScanare,
                    uid_used: 'manual',
                })
            setOreScanare(prev => ({ ...prev, [studentId]: oraScanare }))
            setAttendanceIds(prev => new Set([...prev, studentId]))
        } else {
            setOreScanare(prev => ({ ...prev, [studentId]: new Date(existing.scanned_at).toISOString() }))
            setAttendanceIds(prev => new Set([...prev, studentId]))
        }

        setModalLoc(null)
    }


    async function handleDeconectare() {
        await supabase.auth.signOut()
        router.push('/')
    }


    // Calculează prezenți din ambele surse
    const prezentiIds = new Set([
        ...locuri.filter(l => l.ocupat && l.student_id).map(l => l.student_id as string),
        ...attendanceIds,
    ])
    const nrPrezentiTotal = studenti.filter(s => prezentiIds.has(s.id)).length


    // Export Excel
    async function handleExportExcel() {
        if (!orarCurent) return
        setExportLoading(true)

        try {
            const randuri = studenti.map(s => ({
                'Nr. Matricol': s.student_number ?? '—',
                'Nume Student': s.full_name,
                'Grupă': s.grupa ?? '—',
                'Ora intrării': oreScanare[s.id] ? new Date(oreScanare[s.id]).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' }) : '—',
                'Prezent': prezentiIds.has(s.id) ? 'Prezent(ă)' : 'Absent(ă)',
            }))

            const dataAzi = new Date().toLocaleDateString('ro-RO')
            const numeMaterie = orarCurent.materie.replace(/[^a-zA-Z0-9 ]/g, '')

            const ws = XLSX.utils.json_to_sheet(randuri)
            ws['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]

            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Prezenta')
            XLSX.writeFile(wb, `Prezenta_${numeMaterie}_${dataAzi}.xlsx`)
        } finally {
            setExportLoading(false)
        }
    }


    const prezenti = locuri.filter(l => l.ocupat)
    const libere = locuri.filter(l => !l.ocupat)
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
                    {numeProfesor && (
                        <span className={styles.numeProfesor}>👤 {numeProfesor}</span>
                    )}
                    <button className={styles.butonInapoi} onClick={handleDeconectare}>
                        ⎋ Deconectare
                    </button>
                </div>
            </header>


            <div className={styles.container}>


                {/* Banner orar curent */}
                {orarCurent ? (
                    <div className={styles.orarBanner}>
                        <span>📚 <strong>{orarCurent.materie}</strong></span>
                        <span>👥 Grupa: <strong>{orarCurent.grupa}</strong></span>
                        <span>🕐 {orarCurent.ora_start.slice(0, 5)} – {orarCurent.ora_end.slice(0, 5)}</span>
                        <span>📅 Săpt. <strong>{getSaptamana()}</strong></span>
                    </div>
                ) : (
                    <div className={styles.orarBannerGol}>
                        Nicio oră în desfășurare momentan
                    </div>
                )}


                <div className={styles.infoBar}>
                    {[
                        { label: 'Sală', value: ROOM_ID.toUpperCase() },
                        { label: 'Prezenți', value: nrPrezentiTotal, cls: styles.verde },
                        { label: 'Locuri libere', value: libere.length, cls: styles.rosu },
                    ].map(({ label, value, cls }) => (
                        <div key={label} className={styles.infoBarItem}>
                            <span className={styles.infoBarLabel}>{label}</span>
                            <span className={`${styles.infoBarValue} ${cls ?? ''}`}>{value}</span>
                        </div>
                    ))}
                </div>


                <div className={styles.tabs}>
                    {([
                        { key: 'sala', label: '🪑 Vizualizare Sală' },
                        { key: 'prezenti', label: `👥 Prezenți (${nrPrezentiTotal})` },
                        { key: 'statistici', label: '📊 Statistici' },
                    ] as { key: Tab; label: string }[]).map(t => (
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
                        <p className={styles.cardHint}>
                            Click pe un loc pentru a-l marca ca <strong>liber</strong> sau <strong>ocupat</strong>.
                        </p>
                        <div className={styles.tabla}>TABLĂ</div>
                        <div className={styles.gridLocuri}>
                            {[...locuri].sort((a, b) => a.numar - b.numar).map(loc => (
                                <button
                                    key={loc.id}
                                    className={`${styles.loc} ${loc.ocupat ? styles.locOcupat : styles.locLiber}`}
                                    onClick={() => handleClickLoc(loc)}
                                    title={loc.ocupat ? 'Ocupat — click pentru a elibera' : 'Liber — click pentru a marca ocupat'}
                                >
                                    <span className={styles.locLabel}>loc</span>
                                    <span className={styles.locNr}>{loc.numar}</span>
                                </button>
                            ))}
                        </div>
                        <div className={styles.legenda}>
                            <span className={styles.legendaItem}><span className={styles.dotVerde} /> Liber</span>
                            <span className={styles.legendaItem}><span className={styles.dotRosu} /> Ocupat</span>
                        </div>
                    </div>
                )}


                {/* TAB PREZENȚI */}
                {tabActiv === 'prezenti' && (
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitlu}>
                                Studenți înscriși — {studenti.length} total
                            </h2>
                            <button
                                className={styles.butonExport}
                                onClick={handleExportExcel}
                                disabled={exportLoading || !orarCurent || studenti.length === 0}
                                title={!orarCurent ? 'Nu există oră în desfășurare' : ''}
                            >
                                {exportLoading ? '⏳ Se exportă...' : '📥 Export Excel'}
                            </button>
                        </div>


                        {studenti.length === 0 ? (
                            <p className={styles.gol}>
                                {orarCurent
                                    ? 'Nu există studenți înscriși la această oră.'
                                    : 'Nicio oră în desfășurare momentan.'}
                            </p>
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
                                        const locStudent = locuri.find(
                                            l => l.ocupat && l.student_id === s.id
                                        )
                                        const estePrezent = !!locStudent || attendanceIds.has(s.id)
                                        return (
                                            <tr key={s.id}>
                                                <td>{s.student_number ?? '—'}</td>
                                                <td>{s.full_name}</td>
                                                <td>{s.grupa ?? '—'}</td>
                                                <td>
                                                    <span className={estePrezent ? styles.badgePrezent : styles.badgeAbsent}>
                                                        {estePrezent ? '🟢 Prezent' : '🔴 Absent'}
                                                    </span>
                                                </td>

                                                <td>
                                                    {oreScanare[s.id]
                                                        ? new Date(oreScanare[s.id]).toLocaleTimeString('ro-RO', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            timeZone: 'Europe/Bucharest'
                                                        })
                                                        : '—'
                                                    }
                                                </td>
                                                <td>
                                                    {estePrezent && (
                                                        <button
                                                            className={styles.butonElimina}
                                                            onClick={async () => {
                                                                // Dacă are loc fizic, eliberează locul
                                                                if (locStudent) {
                                                                    await elibereazaLoc(locStudent)
                                                                }
                                                                if (scheduleId) {
                                                                    await supabase
                                                                        .from('attendance')
                                                                        .delete()
                                                                        .eq('student_id', s.id)
                                                                        .eq('schedule_id', scheduleId)
                                                                }
                                                                setAttendanceIds(prev => {
                                                                    const next = new Set(prev)
                                                                    next.delete(s.id)
                                                                    return next
                                                                })
                                                                setOreScanare(prev => {
                                                                    const next = { ...prev }
                                                                    delete next[s.id]
                                                                    return next
                                                                })
                                                            }}
                                                        >
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
                        <div className={styles.card}>
                            <p className={styles.statBarLabel}>Prezență oră curentă</p>
                            <div className={styles.statBar}>
                                <div className={styles.statBarFill} style={{ width: `${procent}%` }} />
                            </div>
                            <p className={styles.statBarText}>
                                {nrPrezentiTotal} din {studenti.length} studenți prezenți ({procent}%)
                            </p>
                        </div>
                    </div>
                )}


                {/* MODAL SELECTARE STUDENT */}
                {modalLoc && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div className={styles.card} style={{ width: '400px', maxHeight: '80vh', overflow: 'auto' }}>
                            <h3 className={styles.cardTitlu}>
                                Selectează student — Loc {modalLoc.numar}
                            </h3>
                            <p style={{ marginBottom: '1rem', color: '#666' }}>
                                Cine ocupă acest loc?
                            </p>
                            {studenti.length === 0 ? (
                                <p style={{ color: '#999' }}>Nu există studenți înscriși la ora curentă.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {studenti.map(s => {
                                        const areLocOcupat = locuri.some(
                                            l => l.ocupat && l.student_id === s.id
                                        )
                                        return (
                                            <button
                                                key={s.id}
                                                className={styles.butonStudent}
                                                onClick={() => !areLocOcupat && asigneazaStudent(s.id)}
                                                disabled={areLocOcupat}
                                                style={{
                                                    opacity: areLocOcupat ? 0.4 : 1,
                                                    cursor: areLocOcupat ? 'not-allowed' : 'pointer',
                                                }}
                                            >
                                                {areLocOcupat ? '✅' : '👤'} {s.full_name}
                                                {areLocOcupat && (
                                                    <em style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: '#888' }}>
                                                        deja prezent
                                                    </em>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                            <button
                                className={styles.butonElimina}
                                style={{ marginTop: '1rem', width: '100%' }}
                                onClick={() => setModalLoc(null)}
                            >
                                Anulează
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}