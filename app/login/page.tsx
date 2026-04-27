'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'
import styles from './page.module.css'

export default function LoginPage() {
    const supabase = createClient()
    const router = useRouter()

    const [email, setEmail] = useState('')
    const [parola, setParola] = useState('')
    const [loading, setLoading] = useState(false)
    const [eroare, setEroare] = useState('')

    async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setEroare('')

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password: parola,
        })

        if (error) {
            setEroare('Email sau parolă incorectă.')
            setLoading(false)
            return
        }

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
            setEroare('Nu s-a putut încărca utilizatorul.')
            setLoading(false)
            return
        }

        const { data: profil, error: profilError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profilError || !profil) {
            setEroare('Nu s-a putut încărca profilul utilizatorului.')
            setLoading(false)
            return
        }

        if (profil.role === 'admin') {
            router.push('/admin')
        } else if (profil.role === 'profesor') {
            router.push('/profesor')
        } else {
            router.push('/')
        }

        router.refresh()
        setLoading(false)
    }

    return (
        <main className={styles.main}>
            <div className={styles.card}>
                <h1 className={styles.titlu}>Autentificare</h1>
                <p className={styles.subtitlu}>
                    Conectează-te cu contul tău pentru a accesa platforma.
                </p>

                <form onSubmit={handleLogin} className={styles.form}>
                    <div className={styles.camp}>
                        <label htmlFor="email" className={styles.label}>Email</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="exemplu@usv.ro"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.camp}>
                        <label htmlFor="parola" className={styles.label}>Parolă</label>
                        <input
                            id="parola"
                            type="password"
                            placeholder="Introdu parola"
                            value={parola}
                            onChange={(e) => setParola(e.target.value)}
                            required
                            className={styles.input}
                        />
                    </div>

                    {eroare ? (
                        <p className={styles.eroare}>{eroare}</p>
                    ) : null}

                    <button
                        type="submit"
                        disabled={loading}
                        className={styles.buton}
                    >
                        {loading ? 'Se conectează...' : 'Conectare'}
                    </button>
                </form>
            </div>
        </main>
    )
}