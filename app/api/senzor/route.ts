import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    try {
        const { room, count } = await req.json()

        if (!room || count === undefined) {
            return NextResponse.json({ error: 'Câmpurile room și count sunt obligatorii' }, { status: 400 })
        }

        // Actualizăm numărul de persoane fizice din sală
        const { error } = await supabase
            .from('rooms')
            .update({ persoane_prezente: count })
            .eq('id', room.toLowerCase())

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            status: 'ok',
            message: 'Număr persoane actualizat cu succes',
            persoane: count
        }, { status: 200 })

    } catch (error) {
        return NextResponse.json({ error: 'A apărut o eroare la procesarea cererii' }, { status: 500 })
    }
}