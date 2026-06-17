import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'


const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function getSaptamana(): 'par' | 'impar' {
    const startAnScolar = new Date('2025-09-29')
    const acum = new Date()
    const saptamaniTrecute = Math.floor(
        (acum.getTime() - startAnScolar.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )
    return saptamaniTrecute % 2 === 0 ? 'impar' : 'par'
}

export async function GET(req: NextRequest) {
    const room = req.nextUrl.searchParams.get('room')
    if (!room) {
        return NextResponse.json({ error: 'room lipsă' }, { status: 400 })
    }

    const acum = new Date()
    const bucuresti = new Date(
        acum.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' })
    )
    const zi = bucuresti.getDay() === 0 ? 7 : bucuresti.getDay()
    const hh = String(bucuresti.getHours()).padStart(2, '0')
    const mm = String(bucuresti.getMinutes()).padStart(2, '0')
    const ora = `${hh}:${mm}`
    const saptamana = getSaptamana()

    const { data: seats } = await supabase
        .from('room_seats')
        .select('numar, ocupat, rezervat')
        .eq('room_id', room)
        .order('numar')

    const { data: schedule } = await supabase
        .from('schedule')
        .select('materie, grupa, ora_start, ora_end')
        .eq('room_id', room)
        .eq('zi', zi)
        .lte('ora_start', ora)
        .gte('ora_end', ora)
        .or(`saptamana.is.null,saptamana.eq.${saptamana}`)
        .maybeSingle()

    const total = seats?.length ?? 0
    const occupied = seats?.filter(s => s.ocupat).length ?? 0
    const free = total - occupied

    let displayInterval = "PAUZA / LIBER"
    if (schedule) {
        const start = schedule.ora_start.substring(0, 5)
        const end = schedule.ora_end.substring(0, 5)
        displayInterval = `${start} - ${end}`
    }

    return NextResponse.json({
        room,
        time: displayInterval,
        weekType: saptamana,
        total,
        occupied,
        free,
        current: schedule
            ? {
                subject: schedule.materie,
                group: schedule.grupa,
                start: schedule.ora_start,
                end: schedule.ora_end,
                isBreak: schedule.materie === 'PAUZA',
            }
            : null,
        seats: seats ?? [],
    })
}