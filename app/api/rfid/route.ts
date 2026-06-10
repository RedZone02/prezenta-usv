import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    const { uid, room } = await req.json()

    if (!uid || !room) {
        return NextResponse.json({ error: 'uid si room sunt obligatorii' }, { status: 400 })
    }

    // 1. Gaseste studentul dupa UID direct din profiles
    const { data: student } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('rfid_uid', uid.toUpperCase())
        .single()

    if (!student) {
        return NextResponse.json({ error: 'Card necunoscut', uid }, { status: 404 })
    }

    // 2. Gaseste sala dupa nume
    const { data: room_data } = await supabase
        .from('rooms')
        .select('id')
        .eq('name', room)
        .single()

    if (!room_data) {
        return NextResponse.json({ error: 'Sala negasita' }, { status: 404 })
    }

    // 3. Gaseste orarul curent al salii
    const now = new Date()
    const zi = now.getDay() === 0 ? 7 : now.getDay()
    const oraAcum = now.toTimeString().slice(0, 8)

    const { data: orar } = await supabase
        .from('schedule')
        .select('id, materie, grupa')
        .eq('room_id', room_data.id)
        .eq('zi', zi)
        .lte('ora_start', oraAcum)
        .gte('ora_end', oraAcum)
        .maybeSingle()

    if (!orar) {
        return NextResponse.json({ error: 'Nu exista ora activa', uid }, { status: 409 })
    }

    // 4. Verifica daca prezenta a fost deja marcata azi
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

    // 5. Gaseste locul studentului in sala
    const { data: seat } = await supabase
        .from('room_seats')
        .select('numar')
        .eq('room_id', room_data.id)
        .eq('student_id', student.id)
        .maybeSingle()

    // 6. Insereaza prezenta
    const { error: insertError } = await supabase
        .from('attendance')
        .insert({
            student_id: student.id,
            schedule_id: orar.id,
            room_id: room_data.id,
            seat_number: seat?.numar ?? null,
            uid_used: uid.toUpperCase(),
        })

    if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // 7. Returneaza raspuns succes
    return NextResponse.json({
        status: 'ok',
        message: 'Prezenta inregistrata',
        student: student.full_name ?? 'Student',
        materie: orar.materie,
        seat: seat?.numar ?? null
    }, { status: 200 })
}