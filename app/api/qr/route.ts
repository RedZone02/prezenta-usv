import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    //Citim request-ul de la ESP32
    let body;
    try {
        body = await req.json()
    } catch (e) {
        return NextResponse.json({ error: 'Request body invalid' }, { status: 400 })
    }

    // ESP32 trimite acum doar token-ul scurt
    const rawToken = typeof body.qr_data === 'string' ? body.qr_data.trim() : String(body).trim()

    if (!rawToken) {
        return NextResponse.json({ error: 'Cod QR gol' }, { status: 400 })
    }

    //Cauta token-ul in baza de date
    const { data: tokenData } = await supabase
        .from('qr_tokens')
        .select('*')
        .eq('token', rawToken)
        .single()

    if (!tokenData) {
        return NextResponse.json({ error: 'Cod QR invalid sau deja folosit' }, { status: 403 })
    }

    if (new Date(tokenData.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Cod QR expirat. Generează altul!' }, { status: 403 })
    }

    const { data: student } = await supabase
        .from('profiles')
        .select('id, full_name, grupa, role')
        .eq('id', tokenData.student_id)
        .maybeSingle()

    if (!student) {
        return NextResponse.json({ error: 'Student necunoscut' }, { status: 404 })
    }

    const { data: room_data } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', tokenData.room_id.toLowerCase())
        .single()

    if (!room_data) {
        return NextResponse.json({ error: 'Sala negasita' }, { status: 404 })
    }

    // Calculeaza ora si ziua in Romania
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

    //Gaseste orarul activ
    const { data: orar } = await supabase
        .from('schedule')
        .select('id, materie, grupa')
        .eq('room_id', room_data.id)
        .eq('zi', zi)
        .lte('ora_start', oraAcum)
        .gte('ora_end', oraAcum)
        .maybeSingle()

    if (!orar) {
        return NextResponse.json({ error: 'Nu exista ora activa in aceasta sala', zi, oraAcum }, { status: 409 })
    }

    //Verifica grupa studentului
    if (orar.grupa.trim().toLowerCase() !== student.grupa.trim().toLowerCase()) {
        return NextResponse.json({ error: 'Nu esti inscris la aceasta ora', grupa_student: student.grupa, grupa_orar: orar.grupa }, { status: 403 })
    }

    //Verifica daca prezenta e deja marcata
    const { data: existent } = await supabase
        .from('attendance')
        .select('id, scanned_at')
        .eq('student_id', student.id)
        .eq('schedule_id', orar.id)
        .gte('scanned_at', new Date().toISOString().slice(0, 10))
        .maybeSingle()

    if (existent) {
        // Dacă e deja marcat, șterge token-ul ca să curățăm baza de date
        await supabase.from('qr_tokens').delete().eq('token', rawToken)

        return NextResponse.json({
            status: 'already_marked',
            message: 'Prezenta deja inregistrata',
            student: student.full_name,
            scanned_at: existent.scanned_at
        }, { status: 200 })
    }

    //Gaseste primul loc liber
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

    //Marcheaza locul ca ocupat
    const { error: seatUpdateError } = await supabase
        .from('room_seats')
        .update({ ocupat: true, student_id: student.id })
        .eq('room_id', room_data.id)
        .eq('numar', freeSeat.numar)

    if (seatUpdateError) {
        return NextResponse.json({ error: seatUpdateError.message }, { status: 500 })
    }

    const { error: insertError } = await supabase
        .from('attendance')
        .insert({
            student_id: student.id,
            schedule_id: orar.id,
            room_id: room_data.id,
            seat_number: freeSeat.numar,
            uid_used: 'QR_AUTH',
        })

    if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    //Ștergem token-ul pentru a preveni reutilizarea lui
    await supabase.from('qr_tokens').delete().eq('token', rawToken)

    //Returnam succesul
    return NextResponse.json({
        status: 'ok',
        message: 'Prezenta inregistrata',
        student: student.full_name ?? 'Student',
        materie: orar.materie,
        seat: freeSeat.numar
    }, { status: 200 })
}