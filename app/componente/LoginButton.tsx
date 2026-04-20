'use client'


import styles from './module_css/LoginButton.module.css'

type Props = {
    logat: boolean
    numeStudent?: string
    onLogin: () => void
    onDeconectare: () => void
}

export default function LoginButton({ logat, numeStudent, onLogin, onDeconectare }: Props) {
    if (logat) {
        return (
            <div className={styles.wrapper}>
                <span className={styles.numeStudent}>{numeStudent}</span>
                <button className={styles.butonDeconectare} onClick={onDeconectare}>
                    Deconectare
                </button>
            </div>
        )
    }

    return (
        <button className={styles.buton} onClick={onLogin}>
            Login
        </button>
    )
}