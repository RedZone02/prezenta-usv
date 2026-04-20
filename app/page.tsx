'use client'

import { corpuri } from './lib/date'
import type { Corp, Sala, Loc } from './lib/tipuri'

import { useState } from 'react'
import styles from './page.module.css'
import SalaGrid from './componente/SalaGrid'
import LoginButton from './componente/LoginButton'
import ModalQR from './componente/ModalQR'
import Drawer from './componente/Drawer'

const studentMock = {
  nume: 'Popescu Alexandru',
  studentId: 'USV2024001',
}

export default function Home() {
  const [corpSelectat, setCorpSelectat] = useState(corpuri[0])
  const [salaSelectata, setSalaSelectata] = useState(corpuri[0].sali[0])
  const [logat, setLogat] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const oraAcum = new Date().toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  })

  function handleCorpChange(corpId: string) {
    const corp = corpuri.find((c) => c.id === corpId)!
    setCorpSelectat(corp)
    setSalaSelectata(corp.sali[0])
  }

  function handleSalaChange(salaId: string) {
    const sala = corpSelectat.sali.find((s) => s.id === salaId)!
    setSalaSelectata(sala)
  }

  const locuriLibere = salaSelectata.locuri.filter((l) => !l.ocupat).length
  const locuriOcupate = salaSelectata.locuri.filter((l) => l.ocupat).length

  return (
    <main className={styles.main}>

      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className={styles.butonMeniu}
            onClick={() => setDrawerOpen(true)}
            aria-label="Deschide meniu"
          >
            ☰
          </button>
          <h1 className={styles.headerTitlu}>Sistem Prezență USV</h1>
        </div>
        <LoginButton
          logat={logat}
          numeStudent={studentMock.nume}
          onLogin={() => setLogat(true)}
          onDeconectare={() => { setLogat(false); setShowQR(false) }}
        />
      </header>

      <div className={styles.container}>
        <div className={styles.grid}>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.card}>
              <p className={styles.cardTitlu}>Selectare sală</p>
              <div className={styles.selectGroup}>
                <div>
                  <label className={styles.selectLabel}>Corp</label>
                  <select
                    className={styles.select}
                    value={corpSelectat.id}
                    onChange={(e) => handleCorpChange(e.target.value)}
                  >
                    {corpuri.map((c) => (
                      <option key={c.id} value={c.id}>{c.nume}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={styles.selectLabel}>Sală</label>
                  <select
                    className={styles.select}
                    value={salaSelectata.id}
                    onChange={(e) => handleSalaChange(e.target.value)}
                  >
                    {corpSelectat.sali.map((s) => (
                      <option key={s.id} value={s.id}>{s.nume}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <p className={styles.cardTitlu}>Informații sală</p>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Ora curentă</span>
                <span className={styles.infoValue}>{oraAcum}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Interval orar</span>
                <span className={styles.infoValue}>{salaSelectata.orar.ora}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Materie</span>
                <span className={styles.infoValue}>{salaSelectata.orar.materie}</span>
              </div>
              <hr className={styles.infoDivider} />
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Profesor</span>
                <span className={styles.infoValue}>{salaSelectata.orar.profesor}</span>
              </div>
              <hr className={styles.infoDivider} />
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Locuri libere</span>
                <span className={styles.locuriLibere}>{locuriLibere}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Locuri ocupate</span>
                <span className={styles.locuriOcupate}>{locuriOcupate}</span>
              </div>
            </div>
          </aside>

          {/* Centru */}
          <div className={styles.centru}>
            <div className={styles.salaCard}>
              <h2 className={styles.salaTitlu}>{salaSelectata.nume}</h2>
              <SalaGrid locuri={salaSelectata.locuri} />
            </div>

            {logat && (
              <>
                <div className={styles.qrCard}>
                  <button
                    className={styles.butonQR}
                    onClick={() => setShowQR(true)}
                  >
                    Generează cod QR
                  </button>
                </div>

                {showQR && (
                  <ModalQR
                    studentId={studentMock.studentId}
                    numeStudent={studentMock.nume}
                    onInchide={() => setShowQR(false)}
                  />
                )}
              </>
            )}
          </div>

        </div>
      </div>
      <Drawer open={drawerOpen} onInchide={() => setDrawerOpen(false)}>
        <div className={styles.card}>
          <p className={styles.cardTitlu}>Selectare sală</p>
          <div className={styles.selectGroup}>
            <div>
              <label className={styles.selectLabel}>Corp</label>
              <select
                className={styles.select}
                value={corpSelectat.id}
                onChange={(e) => { handleCorpChange(e.target.value); }}
              >
                {corpuri.map((c) => (
                  <option key={c.id} value={c.id}>{c.nume}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={styles.selectLabel}>Sală</label>
              <select
                className={styles.select}
                value={salaSelectata.id}
                onChange={(e) => handleSalaChange(e.target.value)}
              >
                {corpSelectat.sali.map((s) => (
                  <option key={s.id} value={s.id}>{s.nume}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <p className={styles.cardTitlu}>Informații sală</p>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Ora curentă</span>
            <span className={styles.infoValue}>{oraAcum}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Interval orar</span>
            <span className={styles.infoValue}>{salaSelectata.orar.ora}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Materie</span>
            <span className={styles.infoValue}>{salaSelectata.orar.materie}</span>
          </div>
          <hr className={styles.infoDivider} />
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Profesor</span>
            <span className={styles.infoValue}>{salaSelectata.orar.profesor}</span>
          </div>
          <hr className={styles.infoDivider} />
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Locuri libere</span>
            <span className={styles.locuriLibere}>{locuriLibere}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Locuri ocupate</span>
            <span className={styles.locuriOcupate}>{locuriOcupate}</span>
          </div>
        </div>
      </Drawer>
    </main>
  )
}