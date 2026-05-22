// app/lib/date.ts
'use client'

import { createClientBrowser } from './supabase/client'
import type { Corp, Sala, Loc } from './tipuri'

export async function loadCorpuri(): Promise<Corp[]> {
    const supabase = createClientBrowser()

    // 1. Luăm toate clădirile
    const { data: buildings, error: bErr } = await supabase
        .from('buildings')
        .select('id, name')
        .order('name')

    if (bErr || !buildings) return []

    // 2. Luăm sălile + locurile
    const { data: rooms, error: rErr } = await supabase
        .from('rooms')
        .select('id, building_id, name, rows, cols, ora, materie, profesor, grupa, room_seats ( numar, ocupat, rezervat )')
        .order('name')

    if (rErr || !rooms) return []

    // 3. Grupăm înapoi în structura Corp[]
    const corpMap = new Map<string, Corp>()

    for (const b of buildings) {
        corpMap.set(b.id, {
            id: b.id,
            nume: b.name,
            sali: [],
        })
    }

    for (const r of rooms as any[]) {
        const corp = corpMap.get(r.building_id)
        if (!corp) continue

        const sala: Sala = {
            id: r.id,
            nume: r.name,
            randuri: r.rows,
            coloane: r.cols,
            orar: {
                ora: r.ora,
                materie: r.materie,
                profesor: r.profesor,
                grupa: r.grupa,
            },
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