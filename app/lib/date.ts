'use client'

import { createClientBrowser } from './supabase/client'
import type { Corp, Sala, Loc } from './tipuri'

// Calculează săptămâna par/impar față de începutul anului școlar
export function getSaptamana(): 'par' | 'impar' {
    const startAnScolar = new Date('2025-09-29') // prima luni a anului școlar
    const acum = new Date()
    const saptamaniTrecute = Math.floor(
        (acum.getTime() - startAnScolar.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )
    return saptamaniTrecute % 2 === 0 ? 'impar' : 'par'
}

export async function loadCorpuri(): Promise<Corp[]> {
    const supabase = createClientBrowser()

    // 1. Clădiri
    const { data: buildings, error: bErr } = await supabase
        .from('buildings')
        .select('id, name')
        .order('name')

    if (bErr || !buildings) return []

    // 2. Săli + locuri
    const { data: rooms, error: rErr } = await supabase
        .from('rooms')
        .select('id, building_id, name, rows, cols, room_seats ( numar, ocupat, rezervat )')
        .order('name')

    if (rErr || !rooms) return []

    // 3. Orar curent din schedule (zi + oră + săptămână)
    const acum = new Date()
    const ziCurenta = acum.getDay() === 0 ? 7 : acum.getDay() // 1-7 (L-D)
    const oraAcum = acum.toTimeString().slice(0, 8)
    const saptamana = getSaptamana()

    const { data: schedules } = await supabase
        .from('schedule')
        .select('id, room_id, materie, grupa, ora_start, ora_end, saptamana, profiles(full_name)')
        .eq('zi', ziCurenta)
        .lte('ora_start', oraAcum)
        .gte('ora_end', oraAcum)
        .or(`saptamana.is.null,saptamana.eq.${saptamana}`)

    // Mapă room_id orar curent
    const orarMap = new Map<string, {
        ora: string
        materie: string
        profesor: string
        grupa: string
    }>()

    for (const s of schedules ?? []) {
        const profesor = (s.profiles as any)?.full_name ?? '-'
        orarMap.set(s.room_id, {
            ora: `${s.ora_start.slice(0, 5)} - ${s.ora_end.slice(0, 5)}`,
            materie: s.materie,
            profesor,
            grupa: s.grupa,
        })
    }

    // 4. Grupăm în Corp[]
    const corpMap = new Map<string, Corp>()
    for (const b of buildings) {
        corpMap.set(b.id, { id: b.id, nume: b.name, sali: [] })
    }

    for (const r of rooms as any[]) {
        const corp = corpMap.get(r.building_id)
        if (!corp) continue

        const orarCurent = orarMap.get(r.id) ?? {
            ora: '-',
            materie: 'Nicio oră în desfășurare',
            profesor: '-',
            grupa: '-',
        }

        const sala: Sala = {
            id: r.id,
            nume: r.name,
            randuri: r.rows,
            coloane: r.cols,
            orar: orarCurent,
            locuri: (r.room_seats ?? []).map((s: any): Loc => ({
                id: `${r.id}-loc-${s.numar}`,
                numar: s.numar,
                ocupat: s.ocupat,
                rezervat: s.rezervat,
            })),
        }

        corp.sali.push(sala)
    }

    return Array.from(corpMap.values())
}