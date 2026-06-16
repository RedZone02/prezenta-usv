'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientBrowser } from '../lib/supabase/client'
import styles from './page.module.css'
import { getSaptamana } from '../lib/date'

type Profil = {
    full_name: string
    email: string
    role: string
}

type Student = {
    id: string
    nr_matricol: string
    grupa: string
    an: number
    specializare: string
    facultate: string
}

type OrarEntry = {
    id: string
    zi: number
    ora_start: string
    ora_end: string
    grupa: string
    room_id: string | null
    saptamana: 'par' | 'impar' | null
    materie: string
    profiles: { full_name: string } | null
}

const ZILE = ['', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']


export default function StudentPage() {
    const supabase = createClientBrowser()
    const router = useRouter()
    const [profil, setProfil] = useState<Profil | null>(null)
    const [student, setStudent] = useState<Student | null>(null)
    const [orar, setOrar] = useState<OrarEntry[]>([])
    const [loading, setLoading] = useState(true)
    const saptamanaCurenta = getSaptamana()

    useEffect(() => {
        async function incarcaDate() {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser()

            if (userError || !user) {
                router.push('/login')
                return
            }

            // Profil
            const { data: profilData } = await supabase
                .from('profiles')
                .select('full_name, email, role')
                .eq('id', user.id)
                .single()

            if (!profilData || profilData.role !== 'student') {
                router.push('/login')
                return
            }

            setProfil(profilData)

            // Date student
            const { data: studentData } = await supabase
                .from('profiles')
                .select('id, nr_matricol, grupa, an, specializare, facultate')
                .eq('id', user.id)
                .single()

            if (!studentData) {
                setLoading(false)
                return
            }

            setStudent(studentData)

            // Orar pentru grupa studentului
            const { data: orarData } = await supabase
                .from('schedule')
                .select(`
                    id,
                    zi,
                    ora_start,
                    ora_end,
                    grupa,
                    room_id,
                    saptamana,
                    materie,
                    profesor_id,
                    profiles!profesor_id ( full_name )
                `)
                .eq('grupa', studentData.grupa)
                .or(`saptamana.is.null,saptamana.eq.${getSaptamana()}`)
                .order('zi', { ascending: true })
                .order('ora_start', { ascending: true })
            setOrar((orarData as OrarEntry[]) ?? [])
            setLoading(false)
        }

        incarcaDate()
    }, [])

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/')
    }
    async function butonInapoi() {
        router.push('/')
    }
    if (loading) {
        return (
            <main className={styles.main}>
                <p className={styles.loading}>Se încarcă datele...</p>
            </main>
        )
    }

    return (
        <main className={styles.main}>

            {/* Header */}
            <header className={styles.header}>
                <h1 className={styles.headerTitlu}>Sistem Prezență USV</h1>
                <div className={styles.headerDreapta}>
                    <span className={styles.butonInapoi} onClick={butonInapoi}>
                        Inapoi
                    </span>
                    <button className={styles.butonLogout} onClick={handleLogout}>
                        Deconectare
                    </button>
                </div>
            </header>

            <div className={styles.continut}>

                {/* Card profil student */}
                <section className={styles.card}>
                    <h2 className={styles.cardTitlu}>Profilul meu</h2>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Nume</span>
                            <span className={styles.infoValoare}>{profil?.full_name}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Email</span>
                            <span className={styles.infoValoare}>{profil?.email}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Nr. matricol</span>
                            <span className={styles.infoValoare}>{student?.nr_matricol ?? '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Grupă</span>
                            <span className={styles.infoValoare}>{student?.grupa ?? '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>An</span>
                            <span className={styles.infoValoare}>{student?.an ?? '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Specializare</span>
                            <span className={styles.infoValoare}>{student?.specializare ?? '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Facultate</span>
                            <span className={styles.infoValoare}>{student?.facultate ?? '—'}</span>
                        </div>
                    </div>
                </section>

                {/* Card orar */}
                <section className={styles.card}>
                    <h2 className={styles.cardTitlu}>
                        Orarul meu
                        <span className={styles.badgeSaptamana}>
                            Săpt. {saptamanaCurenta}
                        </span>
                    </h2>

                    {orar.length === 0 ? (
                        <p className={styles.gol}>Nu există intrări în orar pentru această săptămână.</p>
                    ) : (
                        <div className={styles.tabelWrapper}>
                            <table className={styles.tabel}>
                                <thead>
                                    <tr>
                                        <th>Zi</th>
                                        <th>Interval</th>
                                        <th>Materie</th>
                                        <th>Profesor</th>
                                        <th>Tip</th>
                                        <th>Sală</th>
                                        <th>Săpt.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orar.map((entry) => (
                                        <tr key={entry.id}>
                                            <td>{ZILE[entry.zi]}</td>
                                            <td>{entry.ora_start} – {entry.ora_end}</td>
                                            <td>{entry.materie ?? '—'}</td>
                                            <td>{entry.profiles?.full_name ?? '—'}</td>
                                            <td>
                                                <span className={entry.saptamana ? styles.badgeSaptamana : styles.badgeSaptamanaToate}>
                                                    {entry.saptamana ?? 'toate'}
                                                </span>
                                            </td>
                                            <td>{entry.room_id ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

            </div>
        </main>
    )
}