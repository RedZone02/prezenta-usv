import styles from './module_css/SalaGrid.module.css'

type Loc = {
    numar: number
    ocupat: boolean
}

type Props = {
    locuri: Loc[]
}

export default function SalaGrid({ locuri }: Props) {
    return (
        <div className={styles.wrapper}>
            <div className={styles.tabla}>Tablă</div>

            <div className={styles.grid}>
                {locuri.map((loc) => (
                    <div
                        key={loc.numar}
                        className={`${styles.loc} ${loc.ocupat ? styles.locOcupat : styles.locLiber}`}
                    >
                        <span className={styles.locNumar}>loc</span>
                        <span>{loc.numar}</span>
                    </div>
                ))}
            </div>

            <div className={styles.legenda}>
                <div className={styles.legendaItem}>
                    <span className={`${styles.dot} ${styles.dotLiber}`} />
                    Liber
                </div>
                <div className={styles.legendaItem}>
                    <span className={`${styles.dot} ${styles.dotOcupat}`} />
                    Ocupat
                </div>
            </div>
        </div>
    )
}