'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './page.module.css'
import { createClientBrowser } from '../lib/supabase/client'
import { useRouter } from 'next/navigation'

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
}

type Tab = 'sala' | 'prezenti' | 'statistici'

export default function ProfesorPage() {
    const supabase = createClientBrowser()
    const router = useRouter()
    const [tabActiv, setTabActiv] = useState<Tab>('sala')
    const [locuri, setLocuri] = useState<Loc[]>([])
    const [loading, setLoading] = useState(true)
    const [studenti, setStudenti] = useState<Student[]>([])
    const [modalLoc, setModalLoc] = useState<Loc | null>(null)
    const ROOM_ID = 'c101'

    // 1. Încarcă locurile
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

    // 2. Realtime
    useEffect(() => {
        async function fetchLocuri() {
            const { data, error } = await supabase
                .from('room_seats')
                .select('*, profiles(full_name)')
                .eq('room_id', ROOM_ID)
                .order('numar')
            if (!error && data) setLocuri(data)
        }

        const channel = supabase
            .channel(`profesor-room-${Date.now()}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'room_seats' },
                () => {
                    fetchLocuri() // reîncarcă cu profiles inclus
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    // 3. Studenți din ora curentă
    useEffect(() => {
        async function fetchStudentiOraActuala() {
            const acum = new Date()
            const ziAzi = acum.getDay() === 0 ? 7 : acum.getDay()
            const bucuresti = new Date(acum.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }))
            const ora = String(bucuresti.getHours()).padStart(2, '0')
            const min = String(bucuresti.getMinutes()).padStart(2, '0')
            const oraAzi = `${ora}:${min}` // garantat "11:14"
            console.log('Zi:', ziAzi, 'Ora:', oraAzi)
            const { data: orarData, error: orarError } = await supabase
                .from('schedule')
                .select('id, materie, grupa, ora_start, ora_end')
                .eq('room_id', ROOM_ID)
                .eq('zi', ziAzi)
                .lte('ora_start', oraAzi)
                .gte('ora_end', oraAzi)
                .single()
            console.log('Orar găsit:', orarData, 'Eroare:', orarError)
            if (!orarData) {
                setStudenti([])
                return
            }

            const { data: enrollData, error: enrollError } = await supabase
                .from('enrollments')
                .select('profiles(id, full_name)')
                .eq('schedule_id', orarData.id)

            console.log('Enrollments:', enrollData, 'Eroare:', enrollError)

            if (enrollData) {
                setStudenti(enrollData.map((e: any) => e.profiles).filter(Boolean))
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
        if (!modalLoc) return
        await supabase
            .from('room_seats')
            .update({ ocupat: true, student_id: studentId })
            .eq('id', modalLoc.id)
        setModalLoc(null)
    }

    async function handleDeconectare() {
        await supabase.auth.signOut()
        router.push('/')
    }

    const prezenti = locuri.filter(l => l.ocupat)
    const libere = locuri.filter(l => !l.ocupat)
    const procent = locuri.length > 0 ? Math.round((prezenti.length / locuri.length) * 100) : 0

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
                    <Link href="/" className={styles.butonInapoi}>← Pagina principală</Link>
                    <button className={styles.butonInapoi} onClick={handleDeconectare}>
                        ⎋ Deconectare
                    </button>
                </div>
            </header>

            <div className={styles.container}>
                <div className={styles.infoBar}>
                    {[
                        { label: 'Sală', value: ROOM_ID.toUpperCase() },
                        { label: 'Prezenți', value: prezenti.length, cls: styles.verde },
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
                        { key: 'prezenti', label: `👥 Prezenți (${prezenti.length})` },
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
                        <h2 className={styles.cardTitlu}>Locuri ocupate — {prezenti.length}</h2>
                        {prezenti.length === 0 ? (
                            <p className={styles.gol}>Niciun loc ocupat momentan.</p>
                        ) : (
                            <table className={styles.tabel}>
                                <thead>
                                    <tr>
                                        <th>Loc nr.</th>
                                        <th>Nume student</th>
                                        <th>Status</th>
                                        <th>Acțiuni</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...prezenti].sort((a, b) => a.numar - b.numar).map(loc => (
                                        <tr key={loc.id}>
                                            <td><span className={styles.locBadge}>{loc.numar}</span></td>
                                            <td>{loc.profiles?.full_name ?? <em style={{ color: '#999' }}>Neidentificat</em>}</td>
                                            <td>{loc.rezervat ? '🟡 Rezervat' : '🟢 Prezent'}</td>
                                            <td>
                                                <button className={styles.butonElimina} onClick={() => elibereazaLoc(loc)}>
                                                    Eliberează
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
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
                                { nr: prezenti.length, label: 'Prezenți', cls: styles.statVerde },
                                { nr: libere.length, label: 'Locuri libere', cls: styles.statGri },
                                { nr: locuri.length, label: 'Total locuri', cls: styles.statAlbastru },
                                { nr: `${procent}%`, label: 'Grad ocupare', cls: styles.statPortocaliu },
                            ].map(({ nr, label, cls }) => (
                                <div key={label} className={`${styles.statCard} ${cls}`}>
                                    <span className={styles.statNr}>{nr}</span>
                                    <span className={styles.statLabel}>{label}</span>
                                </div>
                            ))}
                        </div>
                        <div className={styles.card}>
                            <p className={styles.statBarLabel}>Ocupare sală</p>
                            <div className={styles.statBar}>
                                <div className={styles.statBarFill} style={{ width: `${procent}%` }} />
                            </div>
                            <p className={styles.statBarText}>
                                {prezenti.length} din {locuri.length} locuri ocupate ({procent}%)
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
                                        // Verifică dacă studentul are deja un loc ocupat
                                        const areLocOcupat = locuri.some(
                                            l => l.ocupat && l.student_id === s.id
                                        )
                                        return (
                                            <button
                                                key={s.id}
                                                className={styles.butonStudent}
                                                onClick={() => !areLocOcupat && asigneazaStudent(s.id)}
                                                disabled={areLocOcupat}
                                                title={areLocOcupat ? 'Student deja prezent în sală' : ''}
                                                style={{
                                                    opacity: areLocOcupat ? 0.4 : 1,
                                                    cursor: areLocOcupat ? 'not-allowed' : 'pointer',
                                                }}
                                            >
                                                {areLocOcupat ? '✅' : '👤'} {s.full_name}
                                                {areLocOcupat && <em style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: '#888' }}>deja prezent</em>}
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