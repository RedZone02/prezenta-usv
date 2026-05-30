'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientBrowser } from '../lib/supabase/client'
import styles from './page.module.css'

type Profil = {
    full_name: string
    email: string
    role: string
}

type Student = {
    id: string
    student_number: string
    grupa: string
    an_studiu: number
    facultate: string
}

type OrarEntry = {
    id: string
    zi_saptamana: number
    ora_start: string
    ora_end: string
    grupa: string
    saptamana: 'par' | 'impar' | null
    subjects: { name: string; subject_code: string }[]
    teachers: { profiles: { full_name: string }[] }[]
    rooms: { room_code: string; building: string }[]
}

const ZILE = ['', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']

function getSaptamana(): 'par' | 'impar' {
    const startAnScolar = new Date('2025-09-29') // prima luni a anului școlar
    const acum = new Date()
    const saptamaniTrecute = Math.floor(
        (acum.getTime() - startAnScolar.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )
    return saptamaniTrecute % 2 === 0 ? 'impar' : 'par'
}


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
                .from('students')
                .select('id, student_number, grupa, an_studiu, facultate')
                .eq('id', user.id)
                .single()

            if (!studentData) {
                setLoading(false)
                return
            }

            setStudent(studentData)

            // Orar pentru grupa studentului
            const { data: orarData } = await supabase
                .from('schedule_entries')
                .select(`
                    id,
                    zi_saptamana,
                    ora_start,
                    ora_end,
                    grupa,
                    saptamana,
                    subjects ( name, subject_code ),
                    teachers ( profiles ( full_name ) ),
                    rooms ( room_code, building )
                `)
                .eq('grupa', studentData.grupa)
                .or(`saptamana.is.null,saptamana.eq.${getSaptamana()}`)
                .order('zi_saptamana', { ascending: true })
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
                    <span className={styles.numeStudent}>{profil?.full_name}</span>
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
                            <span className={styles.infoValoare}>{student?.student_number ?? '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Grupă</span>
                            <span className={styles.infoValoare}>{student?.grupa ?? '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>An</span>
                            <span className={styles.infoValoare}>{student?.an_studiu ?? '—'}</span>
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
                                        <th>Sală</th>
                                        <th>Săpt.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orar.map((entry) => (
                                        <tr key={entry.id}>
                                            <td>{ZILE[entry.zi_saptamana]}</td>
                                            <td>{entry.ora_start} – {entry.ora_end}</td>
                                            <td>
                                                <span className={styles.materie}>{entry.subjects?.[0]?.name}</span>
                                                <span className={styles.codMaterie}>{entry.subjects?.[0]?.subject_code}</span>
                                            </td>
                                            <td>{entry.teachers?.[0]?.profiles?.[0]?.full_name ?? '—'}</td>
                                            <td>
                                                {entry.rooms?.[0]?.building} — {entry.rooms?.[0]?.room_code}
                                            </td>
                                            <td>
                                                <span className={entry.saptamana ? styles.badgeSaptamana : styles.badgeSaptamanaToate}>
                                                    {entry.saptamana ?? 'toate'}
                                                </span>
                                            </td>
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