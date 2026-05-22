'use client'
import { useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'

type Loc = { id: number; ocupat: boolean; student?: string; oraIntrare?: string }
type Sala = { id: string; nume: string; corp: string; locuri: Loc[] }
type RaportClasa = { grupa: string; facultate: string; totalStudenti: number; prezenti: number; data: string }

const saliDate: Sala[] = [
    {
        id: 'c101', nume: 'C101', corp: 'Corp C',
        locuri: Array.from({ length: 16 }, (_, i) => ({
            id: i + 1,
            ocupat: [2, 3, 6, 7, 12].includes(i + 1),
            student: [2, 3, 6, 7, 12].includes(i + 1) ? `Student ${i + 1}` : undefined,
            oraIntrare: [2, 3, 6, 7, 12].includes(i + 1) ? '10:05' : undefined,
        }))
    },
    {
        id: 'c202', nume: 'C202', corp: 'Corp C',
        locuri: Array.from({ length: 24 }, (_, i) => ({
            id: i + 1,
            ocupat: [1, 2, 4, 5, 8, 9, 10, 15].includes(i + 1),
            student: [1, 2, 4, 5, 8, 9, 10, 15].includes(i + 1) ? `Student ${i + 1}` : undefined,
            oraIntrare: [1, 2, 4, 5, 8, 9, 10, 15].includes(i + 1) ? '08:10' : undefined,
        }))
    },
    {
        id: 'a101', nume: 'A101', corp: 'Corp A',
        locuri: Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            ocupat: [3, 5, 6, 11, 12, 13].includes(i + 1),
            student: [3, 5, 6, 11, 12, 13].includes(i + 1) ? `Student ${i + 1}` : undefined,
            oraIntrare: [3, 5, 6, 11, 12, 13].includes(i + 1) ? '12:15' : undefined,
        }))
    },
]

const rapoarteDate: RaportClasa[] = [
    { grupa: '3A1', facultate: 'FIESC', totalStudenti: 28, prezenti: 24, data: '01.05.2026' },
    { grupa: '3A2', facultate: 'FIESC', totalStudenti: 26, prezenti: 18, data: '01.05.2026' },
    { grupa: '2B1', facultate: 'FIESC', totalStudenti: 30, prezenti: 27, data: '01.05.2026' },
    { grupa: '2B2', facultate: 'FIESC', totalStudenti: 29, prezenti: 20, data: '01.05.2026' },
    { grupa: '1C1', facultate: 'FSE', totalStudenti: 25, prezenti: 22, data: '01.05.2026' },
    { grupa: '4D1', facultate: 'FSE', totalStudenti: 22, prezenti: 15, data: '01.05.2026' },
]

type Tab = 'sali' | 'rapoarte'

export default function AdminPage() {
    const [tabActiv, setTabActiv] = useState<Tab>('sali')
    const [salaSelectata, setSalaSelectata] = useState<Sala>(saliDate[0])
    const [filtreFacultate, setFiltreFacultate] = useState('toate')

    const facultati = ['toate', ...Array.from(new Set(rapoarteDate.map(r => r.facultate)))]
    const rapoarteFiltrate = filtreFacultate === 'toate'
        ? rapoarteDate
        : rapoarteDate.filter(r => r.facultate === filtreFacultate)

    const prezentiSala = salaSelectata.locuri.filter(l => l.ocupat)
    const libereSala = salaSelectata.locuri.filter(l => !l.ocupat)
    const procentSala = Math.round((prezentiSala.length / salaSelectata.locuri.length) * 100)

    return (
        <div className={styles.main}>
            <header className={styles.header}>
                <div className={styles.headerStanga}>
                    <h1 className={styles.headerTitlu}>Sistem Prezență USV</h1>
                    <span className={styles.headerBadge}>Admin</span>
                </div>
                <div className={styles.headerDreapta}>
                    <Link href="/" className={styles.butonInapoi}>← Pagina principală</Link>
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

                        {/* Lista săli */}
                        <div className={styles.saliSidebar}>
                            <div className={styles.card}>
                                <h2 className={styles.cardTitlu}>Săli disponibile</h2>
                                <div className={styles.saliLista}>
                                    {saliDate.map(sala => {
                                        const ocp = sala.locuri.filter(l => l.ocupat).length
                                        const pct = Math.round((ocp / sala.locuri.length) * 100)
                                        return (
                                            <button
                                                key={sala.id}
                                                className={`${styles.salaItem} ${salaSelectata.id === sala.id ? styles.salaItemActiv : ''}`}
                                                onClick={() => setSalaSelectata(sala)}
                                            >
                                                <div className={styles.salaItemHeader}>
                                                    <span className={styles.salaItemNume}>{sala.nume}</span>
                                                    <span className={styles.salaItemCorp}>{sala.corp}</span>
                                                </div>
                                                <div className={styles.salaItemBar}>
                                                    <div
                                                        className={styles.salaItemBarFill}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <div className={styles.salaItemStats}>
                                                    <span className={styles.verde}>{ocp} ocupate</span>
                                                    <span className={styles.rosu}>{sala.locuri.length - ocp} libere</span>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Detaliu sală selectată */}
                        <div className={styles.salaDetaliu}>
                            <div className={styles.card}>
                                <div className={styles.salaDetaliuHeader}>
                                    <h2 className={styles.cardTitlu}>Sală {salaSelectata.nume} — {salaSelectata.corp}</h2>
                                    <div className={styles.salaDetaliuStats}>
                                        <span className={styles.statChip + ' ' + styles.statVerde}>{prezentiSala.length} ocupate</span>
                                        <span className={styles.statChip + ' ' + styles.statRosu}>{libereSala.length} libere</span>
                                        <span className={styles.statChip + ' ' + styles.statAlbastru}>{procentSala}% ocupare</span>
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

                            {/* Prezenți în sala selectată */}
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