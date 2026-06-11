import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    function getSaptamana(): 'par' | 'impar' {
        const startAnScolar = new Date('2025-09-29')
        const acum = new Date()
        const saptamaniTrecute = Math.floor(
            (acum.getTime() - startAnScolar.getTime()) / (7 * 24 * 60 * 60 * 1000)
        )
        return saptamaniTrecute % 2 === 0 ? 'impar' : 'par'
    }

    const { uid, room } = await req.json()

    if (!uid || !room) {
        return NextResponse.json({ error: 'uid si room sunt obligatorii' }, { status: 400 })
    }

    // 1. Gaseste studentul
    const normalizedUid = String(uid).trim().toUpperCase()
    const { data: student } = await supabase
        .from('profiles')
        .select('id, full_name, rfid_uid, grupa, role')
        .eq('rfid_uid', normalizedUid)
        .maybeSingle()

    if (!student) {
        return NextResponse.json({ error: 'Card necunoscut', uid }, { status: 404 })
    }

    // 2. Gaseste sala
    const { data: room_data } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', room.toLowerCase())
        .single()

    if (!room_data) {
        return NextResponse.json({ error: 'Sala negasita' }, { status: 404 })
    }

    // 3. Calculeaza ora si ziua in Romania (EEST = UTC+3)
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Bucharest',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        weekday: 'short', hourCycle: 'h23'
    })
    const parts = formatter.formatToParts(now)
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'

    const weekdayMap: Record<string, number> = {
        Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7
    }
    const zi = weekdayMap[get('weekday')]
    const oraAcum = `${get('hour')}:${get('minute')}:${get('second')}`
    const saptamana = getSaptamana()

    // 4. Gaseste orarul activ
    const { data: orar } = await supabase
        .from('schedule')
        .select('id, materie, grupa')
        .eq('room_id', room_data.id)
        .eq('zi', zi)
        //.eq('saptamana', saptamana)
        .lte('ora_start', oraAcum)
        .gte('ora_end', oraAcum)
        .maybeSingle()

    if (!orar) {
        return NextResponse.json({ error: 'Nu exista ora activa', zi, oraAcum, saptamana }, { status: 409 })
    }

    // 5. Verifica grupa studentului
    if (orar.grupa.trim().toLowerCase() !== student.grupa.trim().toLowerCase()) {
        return NextResponse.json({ error: 'Nu esti inscris la aceasta ora', grupa_student: student.grupa, grupa_orar: orar.grupa }, { status: 403 })
    }

    // 6. Verifica daca prezenta e deja marcata
    const { data: existent } = await supabase
        .from('attendance')
        .select('id, scanned_at')
        .eq('student_id', student.id)
        .eq('schedule_id', orar.id)
        .gte('scanned_at', new Date().toISOString().slice(0, 10))
        .maybeSingle()

    if (existent) {
        return NextResponse.json({
            status: 'already_marked',
            message: 'Prezenta deja inregistrata',
            student: student.full_name,
            scanned_at: existent.scanned_at
        }, { status: 200 })
    }

    // 7. Gaseste primul loc liber
    const { data: freeSeat, error: freeSeatError } = await supabase
        .from('room_seats')
        .select('numar')
        .eq('room_id', room_data.id)
        .eq('ocupat', false)
        .order('numar', { ascending: true })
        .limit(1)
        .maybeSingle()

    if (freeSeatError || !freeSeat) {
        return NextResponse.json({ error: 'Nu mai exista locuri libere' }, { status: 409 })
    }

    // 8. Marcheaza locul ca ocupat
    const { error: seatUpdateError } = await supabase
    .from('room_seats')
    .update({ ocupat: true, student_id: student.id })
    .eq('room_id', room_data.id)
    .eq('numar', freeSeat.numar)
    if (seatUpdateError) {
        return NextResponse.json({ error: seatUpdateError.message }, { status: 500 })
    }

    // 9. Insereaza prezenta
    const { error: insertError } = await supabase
        .from('attendance')
        .insert({
            student_id: student.id,
            schedule_id: orar.id,
            room_id: room_data.id,
            seat_number: freeSeat.numar,
            uid_used: normalizedUid,
        })

    if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
        status: 'ok',
        message: 'Prezenta inregistrata',
        student: student.full_name ?? 'Student',
        materie: orar.materie,
        seat: freeSeat.numar
    }, { status: 200 })
}