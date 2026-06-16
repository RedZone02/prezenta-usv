import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
    try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({
                error: 'Cheile Supabase (URL sau SERVICE_ROLE_KEY) lipsesc din mediul de rulare!'
            }, { status: 500 })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )

        const body = await req.json()
        const { studentId, salaId } = body
        if (!studentId || !salaId) {
            return NextResponse.json({ error: 'Nu am primit studentId sau salaId de la frontend.' }, { status: 400 })
        }
        //Generare token și inserare în baza de date
        const token = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0')
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
        const { error } = await supabase
            .from('qr_tokens')
            .insert({ token, student_id: studentId, room_id: salaId, expires_at: expiresAt })

        if (error) {
            // Dacă baza de date refuză inserția (ex: tabel lipsă, foreign key invalid), o trimitem la browser
            return NextResponse.json({ error: `Eroare Bază de Date: ${error.message}` }, { status: 500 })
        }
        return NextResponse.json({ token, expiresAt }, { status: 200 })

    } catch (e: any) {
        return NextResponse.json({ error: `Crash intern API: ${e.message}` }, { status: 500 })
    }
}