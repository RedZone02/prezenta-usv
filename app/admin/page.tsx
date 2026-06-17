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
type Tab = 'sali' | 'rapoarte' | 'cautare'

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
    const [cautareNume, setCautareNume] = useState('')
    const [rezultatCautare, setRezultatCautare] = useState<{
        id: string
        nume: string
        grupa: string
        facultate: string
        prezente: {
            data: string
            ora: string
            sala: string
            metoda: 'QR' | 'RFID' | 'MANUAL'
            profesor: string
            curs: string
        }[]
    } | null>(null)

    const [cautareLoading, setCautareLoading] = useState(false)
    const [cautareEroare, setCautareEroare] = useState<string | null>(null)
    const [orarCurent, setOrarCurent] = useState<any>(null)
    const [showModalOrar, setShowModalOrar] = useState(false)
    const [salvareLoading, setSalvareLoading] = useState(false)
    const [formOrar, setFormOrar] = useState({
        materie: '',
        grupa: '',
        ora_start: '',
        ora_end: ''
    })

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
                .maybeSingle()
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
            const { data: scanari, error: scanariError } = await supabase
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
                .select('grupa, id, facultate')
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
    async function handleCautareStudent() {
        if (!cautareNume.trim()) return
        setCautareLoading(true)
        setCautareEroare(null)
        setRezultatCautare(null)

        const { data: student } = await supabase
            .from('profiles')
            .select('id, full_name, grupa, facultate')
            .ilike('full_name', `%${cautareNume.trim()}%`)
            .eq('role', 'student')
            .limit(1)
            .maybeSingle()

        if (!student) {
            setCautareEroare('Niciun student găsit cu acest nume.')
            setCautareLoading(false)
            return
        }

        // Ia toate prezențele studentului
        const { data: prezente } = await supabase
            .from('attendance')
            .select('scanned_at, room_id, uid_used')
            .eq('student_id', student.id)
            .order('scanned_at', { ascending: false })

        const roomIds = [...new Set((prezente ?? []).map((p: any) => p.room_id).filter(Boolean))]

        // Preia schedule cu profesor + curs
        let infoPerPrezenta: Record<string, { profesor: string; curs: string }> = {}

        if (prezente && prezente.length > 0) {
            const { data: scheduleData } = await supabase
                .from('schedule')
                .select('room_id, ora_start, ora_end, zi, materie, profiles(full_name)')

            if (scheduleData) {
                prezente.forEach((p: any) => {
                    const data = new Date(p.scanned_at)

                    // zi 1=luni ... 7=duminică (ca în baza ta de date)
                    let ziDb = data.getDay() // 0=duminică, 1=luni...
                    if (ziDb === 0) ziDb = 7

                    const oraTime = data.toLocaleTimeString('ro-RO', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Europe/Bucharest',
                    }).slice(0, 5)

                    const match = (scheduleData as any[]).find(s =>
                        s.room_id === p.room_id &&
                        s.zi === ziDb &&
                        oraTime >= s.ora_start.slice(0, 5) &&
                        oraTime <= s.ora_end.slice(0, 5)
                    )

                    infoPerPrezenta[p.scanned_at] = {
                        profesor: (match?.profiles as any)?.full_name ?? '—',
                        curs: match?.materie ?? '—',
                    }
                })
            }
        }

        const saliMap = Object.fromEntries(sali.map(s => [s.id, s.nume]))

        const listaRezultate = (prezente ?? []).map((p: any) => {
            const uid = (p.uid_used ?? '').toLowerCase()
            let metoda: 'QR' | 'RFID' | 'MANUAL' = 'RFID'
            if (uid === 'qr_auth') metoda = 'QR'
            else if (uid === 'manual') metoda = 'MANUAL'

            return {
                data: new Date(p.scanned_at).toLocaleDateString('ro-RO'),
                ora: new Date(p.scanned_at).toLocaleTimeString('ro-RO', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Bucharest',
                }),
                sala: saliMap[p.room_id] ?? p.room_id ?? '—',
                metoda,
                profesor: infoPerPrezenta[p.scanned_at]?.profesor ?? '—',
                curs: infoPerPrezenta[p.scanned_at]?.curs ?? '—',
            }
        })

        setRezultatCautare({
            id: student.id,
            nume: student.full_name,
            grupa: student.grupa ?? '—',
            facultate: student.facultate ?? '—',
            prezente: listaRezultate,
        })
        setCautareLoading(false)
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
                        { key: 'cautare', label: '🔍 Căutare Student' },
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
                                                            background: pct >= 75 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626'
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
                {/* TAB CĂUTARE STUDENT */}
                {tabActiv === 'cautare' && (
                    <div className={styles.card}>
                        <h2 className={styles.cardTitlu}>Caută prezența unui student</h2>

                        <div className={styles.cautareForm}>
                            <input
                                type="text"
                                placeholder="Introdu numele studentului..."
                                value={cautareNume}
                                onChange={e => setCautareNume(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCautareStudent()}
                                className={styles.cautareInput}
                            />
                            <button
                                className={styles.cautareButon}
                                onClick={handleCautareStudent}
                                disabled={cautareLoading}
                            >
                                {cautareLoading ? 'Se caută...' : 'Caută'}
                            </button>
                        </div>
                        {cautareEroare && (
                            <p className={styles.cautareEroare}>{cautareEroare}</p>
                        )}

                        {rezultatCautare && (
                            <>
                                <div className={styles.rezultatHeader}>
                                    <span className={styles.rezultatNume}>{rezultatCautare.nume}</span>
                                    <span className={styles.locBadge}>{rezultatCautare.grupa}</span>
                                    <span className={styles.rezultatFacultate}>{rezultatCautare.facultate}</span>
                                    <span className={styles.rezultatTotal}>
                                        {rezultatCautare.prezente.length} prezențe înregistrate
                                    </span>
                                </div>

                                {/* Tabel */}
                                {rezultatCautare.prezente.length === 0 ? (
                                    <p style={{ color: 'var(--gri)' }}>Nicio prezență înregistrată.</p>
                                ) : (
                                    <table className={styles.tabel}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Data</th>
                                                <th>Ora</th>
                                                <th>Sala</th>
                                                <th>Curs</th>
                                                <th>Metodă</th>
                                                <th>Profesor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rezultatCautare.prezente.map((p, i) => (
                                                <tr key={i}>
                                                    <td>{i + 1}</td>
                                                    <td>{p.data}</td>
                                                    <td>{p.ora}</td>
                                                    <td>{p.sala}</td>
                                                    <td>{p.curs}</td>
                                                    <td>
                                                        <span
                                                            className={`${styles.metodaBadge} ${p.metoda === 'QR'
                                                                ? styles.metodaQR
                                                                : p.metoda === 'MANUAL'
                                                                    ? styles.metodaManual
                                                                    : styles.metodaRFID
                                                                }`}
                                                        >
                                                            {p.metoda}
                                                        </span>
                                                    </td>
                                                    <td>{p.profesor}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}