'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './page.module.css'
import { createClientBrowser } from '../lib/supabase/client'
import { loadCorpuri } from '../lib/date'
import { useRouter } from 'next/navigation'

type Loc = { id: number; ocupat: boolean; student?: string; oraIntrare?: string }
type Sala = { id: string; nume: string; corp: string; locuri: Loc[] }
type RaportClasa = { grupa: string; facultate: string; totalStudenti: number; prezenti: number; data: string }
type Tab = 'sali' | 'rapoarte'

export default function AdminPage() {
    const supabase = createClientBrowser()
    const router = useRouter()
    const [tabActiv, setTabActiv] = useState<Tab>('sali')
    const [sali, setSali] = useState<Sala[]>([])
    const [corpSelectat, setCorpSelectat] = useState<string | null>(null)
    const [salaSelectata, setSalaSelectata] = useState<Sala | null>(null)
    const [loadingSali, setLoadingSali] = useState(true)
    const [rapoarte, setRapoarte] = useState<RaportClasa[]>([])
    const [filtreFacultate, setFiltreFacultate] = useState('toate')

    // săli + prezențe + rapoarte
    useEffect(() => {
        async function init() {
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) {
                router.push('/')
                return
            }

            const { data: profilData } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            if (!profilData || profilData.role !== 'admin') {
                router.push('/')
                return
            }

            const corpuri = await loadCorpuri()
            const saliReale: Sala[] = corpuri.flatMap(corp =>
                corp.sali.map(sala => ({
                    id: sala.id,
                    nume: sala.nume,
                    corp: corp.nume,
                    locuri: sala.locuri.map(loc => ({
                        id: loc.numar,
                        ocupat: loc.ocupat,
                        student: undefined,
                        oraIntrare: undefined,
                    }))
                }))
            )

            // locuri ocupate cu numele studentului
            const { data: locuriOcupate } = await supabase
                .from('room_seats')
                .select('room_id, numar, student_id, profiles(full_name)')
                .eq('ocupat', true)

            // scanările de azi din attendance
            const azi = new Date().toISOString().split('T')[0]
            const { data: scanari } = await supabase
                .from('attendance')
                .select('student_id, scanned_at')
                .gte('scanned_at', azi)

            // Map student_id fiind cea mai recentă scanare
            const scanariMap: Record<string, string> = {}
            if (scanari) {
                scanari.forEach((s: any) => {
                    if (!scanariMap[s.student_id] || s.scanned_at > scanariMap[s.student_id]) {
                        scanariMap[s.student_id] = s.scanned_at
                    }
                })
            }

            // Populează locurile cu student + oră
            if (locuriOcupate) {
                for (const sala of saliReale) {
                    for (const loc of sala.locuri) {
                        const ocupare = locuriOcupate.find(
                            (o: any) => o.room_id === sala.id && o.numar === loc.id
                        )
                        if (ocupare) {
                            loc.student = (ocupare.profiles as any)?.full_name ?? '—'
                            const scanned = ocupare.student_id ? scanariMap[ocupare.student_id] : null
                            loc.oraIntrare = scanned
                                ? new Date(scanned).toLocaleTimeString('ro-RO', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    timeZone: 'Europe/Bucharest',
                                })
                                : '—'
                        }
                    }
                }
            }

            setSali(saliReale)
            setSalaSelectata(saliReale[0] ?? null)
            setLoadingSali(false)

            // Rapoarte pe grupe 
            const { data: prezGrupe } = await supabase
                .from('attendance')
                .select('student_id, profiles(grupa)')
                .gte('scanned_at', azi)

            const { data: totalGrupe } = await supabase
                .from('profiles')
                .select('grupa, id')
                .eq('role', 'student')
                .not('grupa', 'is', null)

            if (prezGrupe && totalGrupe) {
                const grupe = [...new Set(totalGrupe.map((s: any) => s.grupa))] as string[]
                const rapoarteReale = grupe.map(grupa => ({
                    grupa,
                    facultate: (totalGrupe as any[]).find(s => s.grupa === grupa)?.facultate ?? 'N/A',
                    totalStudenti: totalGrupe.filter((s: any) => s.grupa === grupa).length,
                    prezenti: prezGrupe.filter((p: any) => (p.profiles as any)?.grupa === grupa).length,
                    data: new Date().toLocaleDateString('ro-RO'),
                }))
                setRapoarte(rapoarteReale)
            }
        }
        init()
    }, [])

    // Realtime room_seats
    useEffect(() => {
        const channel = supabase
            .channel('admin-seats')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'room_seats' },
                async (payload: any) => {
                    const updated = payload.new

                    // Re-fetch locul cu student + scanare
                    const { data: locData } = await supabase
                        .from('room_seats')
                        .select('room_id, numar, ocupat, student_id, profiles(full_name)')
                        .eq('room_id', updated.room_id)
                        .eq('numar', updated.numar)
                        .single()

                    const studentNume = (locData?.profiles as any)?.full_name ?? '—'
                    let oraIntrare = '—'
                    if (locData?.student_id) {
                        const azi = new Date().toISOString().split('T')[0]
                        const { data: scanare } = await supabase
                            .from('attendance')
                            .select('scanned_at')
                            .eq('student_id', locData.student_id)
                            .gte('scanned_at', azi)
                            .order('scanned_at', { ascending: false })
                            .limit(1)
                            .maybeSingle()

                        if (scanare) {
                            oraIntrare = new Date(scanare.scanned_at).toLocaleTimeString('ro-RO', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Europe/Bucharest',
                            })
                        }
                    }

                    const updater = (s: Sala) => s.id !== updated.room_id ? s : {
                        ...s,
                        locuri: s.locuri.map(l =>
                            l.id === updated.numar
                                ? { ...l, ocupat: updated.ocupat, student: studentNume, oraIntrare }
                                : l
                        )
                    }
                    setSali(prev => prev.map(updater))
                    setSalaSelectata(prev => prev ? updater(prev) : prev)
                }
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    // Valori derivate
    const facultati = ['toate', ...Array.from(new Set(rapoarte.map(r => r.facultate)))]
    const rapoarteFiltrate = filtreFacultate === 'toate'
        ? rapoarte
        : rapoarte.filter(r => r.facultate === filtreFacultate)

    if (loadingSali) {
        return (
            <div className={styles.main}>
                <p style={{ padding: '2rem' }}>Se încarcă...</p>
            </div>
        )
    }

    async function handleDeconectare() {
        await supabase.auth.signOut()
        router.push('/')
    }

    const prezentiSala = salaSelectata?.locuri.filter(l => l.ocupat) ?? []
    const libereSala = salaSelectata?.locuri.filter(l => !l.ocupat) ?? []
    const procentSala = (salaSelectata && salaSelectata.locuri.length > 0)
        ? Math.round((prezentiSala.length / salaSelectata.locuri.length) * 100)
        : 0

    return (
        <div className={styles.main}>
            <header className={styles.header}>
                <div className={styles.headerStanga}>
                    <h1 className={styles.headerTitlu}>Sistem Prezență USV</h1>
                    <span className={styles.headerBadge}>Admin</span>
                </div>
                <div className={styles.headerDreapta}>
                    <Link href="/" className={styles.butonInapoi} onClick={handleDeconectare}>← Deconectare</Link>
                </div>
            </header>

            <div className={styles.container}>

                {/* TABS */}
                <div className={styles.tabs}>
                    {([
                        { key: 'sali', label: '🏛️ Vizualizare Săli' },
                        { key: 'rapoarte', label: '📋 Rapoarte Prezență' },
                    ] as { key: Tab; label: string }[]).map(t => (
                        <button
                            key={t.key}
                            className={`${styles.tab} ${tabActiv === t.key ? styles.tabActiv : ''}`}
                            onClick={() => setTabActiv(t.key)}
                        >{t.label}</button>
                    ))}
                </div>

                {/* TAB SĂLI */}
                {tabActiv === 'sali' && (
                    <div className={styles.saliLayout}>

                        {/* SIDEBAR */}
                        <div className={styles.saliSidebar}>
                            <div className={styles.card}>
                                {!corpSelectat ? (
                                    <>
                                        <h2 className={styles.cardTitlu}>Selectează corpul</h2>
                                        <div className={styles.saliLista}>
                                            {[...new Set(sali.map(s => s.corp))].map(corp => {
                                                const saliCorp = sali.filter(s => s.corp === corp)
                                                const totalLocuri = saliCorp.reduce((acc, s) => acc + s.locuri.length, 0)
                                                const totalOcupate = saliCorp.reduce((acc, s) => acc + s.locuri.filter(l => l.ocupat).length, 0)
                                                const pct = Math.round((totalOcupate / totalLocuri) * 100) || 0
                                                return (
                                                    <button
                                                        key={corp}
                                                        className={styles.salaItem}
                                                        onClick={() => {
                                                            setCorpSelectat(corp)
                                                            setSalaSelectata(saliCorp[0])
                                                        }}
                                                    >
                                                        <div className={styles.salaItemHeader}>
                                                            <span className={styles.salaItemNume}>{corp}</span>
                                                            <span className={styles.salaItemCorp}>{saliCorp.length} săli</span>
                                                        </div>
                                                        <div className={styles.salaItemBar}>
                                                            <div className={styles.salaItemBarFill} style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <div className={styles.salaItemStats}>
                                                            <span className={styles.verde}>{totalOcupate} ocupate</span>
                                                            <span className={styles.rosu}>{totalLocuri - totalOcupate} libere</span>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                            <button
                                                className={styles.butonInapoi}
                                                onClick={() => {
                                                    setCorpSelectat(null)
                                                    setSalaSelectata(null)
                                                }}
                                            >
                                                ← Înapoi
                                            </button>
                                            <h2 className={styles.cardTitlu} style={{ margin: 0 }}>{corpSelectat}</h2>
                                        </div>
                                        <div className={styles.saliLista}>
                                            {sali.filter(s => s.corp === corpSelectat).map(sala => {
                                                const ocp = sala.locuri.filter(l => l.ocupat).length
                                                const pct = Math.round((ocp / sala.locuri.length) * 100)
                                                return (
                                                    <button
                                                        key={sala.id}
                                                        className={`${styles.salaItem} ${salaSelectata?.id === sala.id ? styles.salaItemActiv : ''}`}
                                                        onClick={() => setSalaSelectata(sala)}
                                                    >
                                                        <div className={styles.salaItemHeader}>
                                                            <span className={styles.salaItemNume}>{sala.nume}</span>
                                                        </div>
                                                        <div className={styles.salaItemBar}>
                                                            <div className={styles.salaItemBarFill} style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <div className={styles.salaItemStats}>
                                                            <span className={styles.verde}>{ocp} ocupate</span>
                                                            <span className={styles.rosu}>{sala.locuri.length - ocp} libere</span>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* DREAPTA */}
                        <div className={styles.salaDetaliu}>
                            {!corpSelectat || !salaSelectata ? (
                                <div className={styles.salaDetaliuGol}>
                                    <span className={styles.salaDetaliuGolIcon}>🏛️</span>
                                    <p>Selectează un corp din stânga pentru a vedea sălile</p>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.card}>
                                        <div className={styles.salaDetaliuHeader}>
                                            <h2 className={styles.cardTitlu}>Sală {salaSelectata.nume} — {salaSelectata.corp}</h2>
                                            <div className={styles.salaDetaliuStats}>
                                                <span className={`${styles.statChip} ${styles.statVerde}`}>{prezentiSala.length} ocupate</span>
                                                <span className={`${styles.statChip} ${styles.statRosu}`}>{libereSala.length} libere</span>
                                                <span className={`${styles.statChip} ${styles.statAlbastru}`}>{procentSala}% ocupare</span>
                                            </div>
                                        </div>
                                        <div className={styles.tabla}>TABLĂ</div>
                                        <div className={styles.gridLocuri}>
                                            {salaSelectata.locuri.map(loc => (
                                                <div
                                                    key={loc.id}
                                                    className={`${styles.loc} ${loc.ocupat ? styles.locOcupat : styles.locLiber}`}
                                                    title={loc.ocupat ? `${loc.student} — ${loc.oraIntrare}` : 'Liber'}
                                                >
                                                    <span className={styles.locLabel}>loc</span>
                                                    <span className={styles.locNr}>{loc.id}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className={styles.legenda}>
                                            <span className={styles.legendaItem}><span className={styles.dotVerde} /> Liber</span>
                                            <span className={styles.legendaItem}><span className={styles.dotRosu} /> Ocupat</span>
                                        </div>
                                    </div>

                                    {prezentiSala.length > 0 && (
                                        <div className={styles.card}>
                                            <h2 className={styles.cardTitlu}>Prezenți în {salaSelectata.nume}</h2>
                                            <table className={styles.tabel}>
                                                <thead>
                                                    <tr><th>Loc</th><th>Student</th><th>Ora intrării</th></tr>
                                                </thead>
                                                <tbody>
                                                    {prezentiSala.map(loc => (
                                                        <tr key={loc.id}>
                                                            <td><span className={styles.locBadge}>{loc.id}</span></td>
                                                            <td>{loc.student ?? '—'}</td>
                                                            <td>{loc.oraIntrare ?? '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                    </div>
                )}

                {/* TAB RAPOARTE */}
                {tabActiv === 'rapoarte' && (
                    <div className={styles.card}>
                        <div className={styles.rapoarteHeader}>
                            <h2 className={styles.cardTitlu}>Raport prezență pe clase</h2>
                            <div className={styles.filtre}>
                                <label className={styles.filtruLabel}>Facultate:</label>
                                <select
                                    className={styles.select}
                                    value={filtreFacultate}
                                    onChange={e => setFiltreFacultate(e.target.value)}
                                >
                                    {facultati.map(f => (
                                        <option key={f} value={f}>{f === 'toate' ? 'Toate' : f}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <table className={styles.tabel}>
                            <thead>
                                <tr>
                                    <th>Grupă</th>
                                    <th>Facultate</th>
                                    <th>Prezenți</th>
                                    <th>Total</th>
                                    <th>Procent</th>
                                    <th>Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rapoarteFiltrate.map(r => {
                                    const pct = Math.round((r.prezenti / r.totalStudenti) * 100)
                                    return (
                                        <tr key={r.grupa}>
                                            <td><span className={styles.locBadge}>{r.grupa}</span></td>
                                            <td>{r.facultate}</td>
                                            <td className={styles.verde}>{r.prezenti}</td>
                                            <td>{r.totalStudenti}</td>
                                            <td>
                                                <div className={styles.raportBar}>
                                                    <div
                                                        className={styles.raportBarFill}
                                                        style={{
                                                            width: `${pct}%`,
                                                            background: pct >= 75 ? 'var(--verde)' : pct >= 50 ? 'var(--portocaliu)' : 'var(--rosu)'
                                                        }}
                                                    />
                                                    <span className={styles.raportPct}>{pct}%</span>
                                                </div>
                                            </td>
                                            <td>{r.data}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

            </div>
        </div>
    )
}