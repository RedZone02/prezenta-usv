'use client'
import { loadCorpuri } from './lib/date'
import type { Corp, Sala } from './lib/tipuri'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import SalaGrid from './componente/SalaGrid'
import LoginButton from './componente/LoginButton'
import ModalQR from './componente/ModalQR'
import Drawer from './componente/Drawer'
import { createClientBrowser } from './lib/supabase/client'
import { useAutoResetSeats } from './lib/useResetLocuri'

type Profil = {
  id: string
  full_name: string
  role: string
}

export default function Home() {
  const supabase = createClientBrowser()
  const router = useRouter()
  const [corpuri, setCorpuri] = useState<Corp[]>([])
  const [corpSelectat, setCorpSelectat] = useState<Corp | null>(null)
  const [salaSelectata, setSalaSelectata] = useState<Sala | null>(null)
  const [logat, setLogat] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profil, setProfil] = useState<Profil | null>(null)
  const [loadingSali, setLoadingSali] = useState(true)
  const [oraAcum, setOraAcum] = useState(() =>
    new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  )
  useAutoResetSeats(supabase, salaSelectata?.id ?? null)

  // incarcare sali din Supabase + verificare user logat
  useEffect(() => {
    async function init() {
      const [data, { data: { user } }] = await Promise.all([
        loadCorpuri(),
        supabase.auth.getUser()
      ])
      setCorpuri(data)
      setCorpSelectat(data[0] ?? null)
      setSalaSelectata(data[0]?.sali[0] ?? null)
      setLoadingSali(false)

      if (user) {
        const { data: profil } = await supabase
          .from('profiles').select('id, full_name, role')
          .eq('id', user.id).single()
        if (profil) {
          setProfil(profil)
          setLogat(true)
          if (profil.role === 'profesor' || profil.role === 'admin')
            router.push(`/${profil.role}`)
        }
      }
    }
    init()
  }, [])

  useEffect(() => {
    console.log('🟡 Realtime useEffect pornit')
    const channel = supabase
      .channel(`room-seats-${Date.now()}`) // nume unic, evită conflicte
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_seats' },
        (payload: any) => {
          const updated = payload.new

          // log de verificare — șterge după ce merge
          console.log('updated:', updated)

          setSalaSelectata(prev => {
            if (!prev) return prev
            // verifică că update-ul e pentru sala curentă
            if (prev.id !== updated.room_id) return prev
            return {
              ...prev,
              locuri: prev.locuri.map(loc =>
                loc.numar === updated.numar  // ← potrivire după numar
                  ? { ...loc, ocupat: updated.ocupat, rezervat: updated.rezervat }
                  : loc
              )
            }
          })

          setCorpuri(prevCorpuri =>
            prevCorpuri.map(corp => ({
              ...corp,
              sali: corp.sali.map(sala =>
                sala.id === updated.room_id
                  ? {
                    ...sala,
                    locuri: sala.locuri.map(loc =>
                      loc.numar === updated.numar  // ← același fix
                        ? { ...loc, ocupat: updated.ocupat, rezervat: updated.rezervat }
                        : loc
                    )
                  }
                  : sala
              )
            }))
          )
        }
      )
      .subscribe((status: string) => {
        console.log('📡 Status:', status)
      })

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    const timer = setInterval(() =>
      setOraAcum(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }))
      , 10000)
    return () => clearInterval(timer)
  }, [])


  function handleCorpChange(corpId: string) {
    const corp = corpuri.find((c) => c.id === corpId)
    if (!corp) return
    setCorpSelectat(corp)
    setSalaSelectata(corp.sali[0] ?? null)
  }

  function handleSalaChange(salaId: string) {
    if (!corpSelectat) return
    const sala = corpSelectat.sali.find((s) => s.id === salaId)
    if (!sala) return
    setSalaSelectata(sala)
  }

  async function handleDeconectare() {
    await supabase.auth.signOut()
    setLogat(false)
    setProfil(null)
    setShowQR(false)
  }
  if (loadingSali || !corpSelectat || !salaSelectata) {
    return (
      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.headerTitlu}>Sistem Prezență USV</h1>
        </header>
        <div className={styles.container}>
          <p>Se încarcă sălile...</p>
        </div>
      </main>
    )
  }
  const locuriLibere = salaSelectata.locuri.filter((l) => !l.ocupat).length
  const locuriOcupate = salaSelectata.locuri.filter((l) => l.ocupat).length

  // Afișează banner în funcție de rezultat

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
        <div className={styles.headerDreapta}>
          <LoginButton
            logat={logat}
            numeStudent={profil?.full_name}
            onDeconectare={handleDeconectare}
            isMobile={false}
          />
        </div>


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
              {/* Interval orar */}
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Interval orar</span>
                <span className={styles.infoValue}>
                  {salaSelectata.orar.materie === 'PAUZA' ? '—' : salaSelectata.orar.ora}
                </span>
              </div>

              {/* Materie */}
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Materie </span>
                <span className={salaSelectata.orar.materie === 'PAUZA'
                  ? styles.orarBannerPauza
                  : styles.infoValue}>
                  {salaSelectata.orar.materie === 'PAUZA'
                    ? `☕ Pauză — ${salaSelectata.orar.ora}`
                    : salaSelectata.orar.materie}
                </span>
              </div>

              {/* Profesor — ascunde la pauză */}
              {salaSelectata.orar.materie !== 'PAUZA' && (
                <>
                  <hr className={styles.infoDivider} />
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Profesor</span>
                    <span className={styles.infoValue}>{salaSelectata.orar.profesor}</span>
                  </div>
                </>
              )}
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
                    studentId={profil?.id ?? ''}
                    numeStudent={profil?.full_name ?? ''}
                    salaId={salaSelectata.id}
                    salaSelectata={salaSelectata}
                    onInchide={() => setShowQR(false)}
                  />
                )}
              </>
            )}
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
              {/* Interval orar */}
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Interval orar</span>
                <span className={styles.infoValue}>
                  {salaSelectata.orar.materie === 'PAUZA' ? '—' : salaSelectata.orar.ora}
                </span>
              </div>

              {/* Materie */}
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Materie</span>
                <span className={salaSelectata.orar.materie === 'PAUZA'
                  ? styles.orarBannerPauza
                  : styles.infoValue}>
                  {salaSelectata.orar.materie === 'PAUZA'
                    ? `☕ Pauză — ${salaSelectata.orar.ora}`
                    : salaSelectata.orar.materie}
                </span>
              </div>

              {/* Profesor — ascunde la pauză */}
              {salaSelectata.orar.materie !== 'PAUZA' && (
                <>
                  <hr className={styles.infoDivider} />
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Profesor</span>
                    <span className={styles.infoValue}>{salaSelectata.orar.profesor}</span>
                  </div>
                </>
              )}
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
            {logat && (
              <div className={styles.card}>
                <p className={styles.cardTitlu}>Contul meu</p>
                <button
                  className={styles.butonProfil}
                  onClick={() => {
                    setDrawerOpen(false)
                    router.push('/student')
                  }}
                >
                  👤 Vezi profilul și orarul
                </button>
                <button
                  className={styles.butonDeconectareDrawer}
                  onClick={() => {
                    setDrawerOpen(false)
                    handleDeconectare()
                  }}
                >
                  ⎋ Deconectare
                </button>
              </div>
            )}
          </Drawer>
        </div>
      </div>
    </main>
  )
}
