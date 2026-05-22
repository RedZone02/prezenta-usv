'use client'
import { useState, useEffect } from 'react'
import styles from './page.module.css'
import Head from 'next/head'

type Loc = {
    id: number
    ocupat: boolean
}

const locuriInitiale: Loc[] = Array.from({ length: 16 }, (_, i) => ({
    id: i + 1,
    ocupat: [2, 3, 6, 7, 12].includes(i + 1),
}))

export default function DisplayPage() {
    const [locuri, setLocuri] = useState<Loc[]>(locuriInitiale)
    const [ora, setOra] = useState('')
    const [data, setData] = useState('')

    useEffect(() => {
        const updateTime = () => {
            const now = new Date()
            setOra(now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }))
            setData(now.toLocaleDateString('ro-RO', { weekday: 'long', day: '2-digit', month: 'long' }))
        }
        updateTime()
        const interval = setInterval(updateTime, 1000)
        return () => clearInterval(interval)
    }, [])

    const libere = locuri.filter(l => !l.ocupat).length
    const ocupate = locuri.filter(l => l.ocupat).length

    return (

        <div className={styles.display}>
            <Head>
                <meta name="viewport" content="width=480, height=320, user-scalable=no" />
            </Head>
            {/* HEADER */}
            <div className={styles.header}>
                <div className={styles.headerStanga}>
                    <span className={styles.salaNume}>Sala C101</span>
                    <span className={styles.materie}>Programare Web</span>
                </div>
                <div className={styles.headerCentru}>
                    <span className={styles.oraText}>{ora}</span>
                    <span className={styles.dataText}>{data}</span>
                </div>
                <div className={styles.headerDreapta}>
                    <span className={styles.intervalLabel}>Interval</span>
                    <span className={styles.interval}>10:00 – 12:00</span>
                </div>
            </div>

            {/* GRID LOCURI */}
            <div className={styles.gridZona}>
                <div className={styles.tabla}>▲ TABLĂ ▲</div>
                <div className={styles.grid}>
                    {locuri.map(loc => (
                        <div
                            key={loc.id}
                            className={`${styles.loc} ${loc.ocupat ? styles.locOcupat : styles.locLiber}`}
                        >
                            {loc.id}
                        </div>
                    ))}
                </div>
            </div>

            {/* FOOTER STATISTICI */}
            <div className={styles.footer}>
                <div className={styles.statLiber}>
                    <span className={styles.statNr}>{libere}</span>
                    <span className={styles.statLabel}>Locuri libere</span>
                </div>
                <div className={styles.separator} />
                <div className={styles.statOcupat}>
                    <span className={styles.statNr}>{ocupate}</span>
                    <span className={styles.statLabel}>Ocupate</span>
                </div>
                <div className={styles.separator} />
                <div className={styles.statTotal}>
                    <span className={styles.statNr}>{locuri.length}</span>
                    <span className={styles.statLabel}>Total</span>
                </div>
            </div>

        </div>
    )
}