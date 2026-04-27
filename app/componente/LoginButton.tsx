'use client'

import Link from 'next/link'
import styles from './module_css/LoginButton.module.css'

type Props = {
    logat: boolean
    numeStudent?: string
    onDeconectare?: () => void
    isMobile?: boolean
}

export default function LoginButton({ logat, numeStudent, onDeconectare, isMobile }: Props) {
    if (logat) {
        // Pe mobil - doar numele, fără buton
        if (isMobile) {
            return (
                <span className={styles.numeMobil}>{numeStudent}</span>
            )
        }

        // Pe desktop - buton care duce la pagina studentului
        return (
            <Link href="/student" className={styles.butonProfil}>
                👤  {numeStudent}
            </Link>
        )
    }

    return (
        <Link href="/login" className={styles.butonLogin}>
            Conectare
        </Link>
    )
}