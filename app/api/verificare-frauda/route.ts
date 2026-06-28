import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    try {
        // 1. Obținem ora și ziua curente pentru a găsi cursurile active
        const now = new Date();
        const currentDay = now.getDay();
        const currentTime = now.toTimeString().split(' ')[0];

        // Găsim toate cursurile a se țin fix acum
        const { data: activeSchedules, error: scheduleError } = await supabase
            .from('schedule')
            .select('id, room_id, profesor_id, materie')
            .eq('zi', currentDay)
            .lte('ora_start', currentTime)
            .gte('ora_end', currentTime);

        if (scheduleError || !activeSchedules) {
            return NextResponse.json({ error: 'Eroare la citirea orarului' }, { status: 500 });
        }

        const alerts = [];

        // 2. Trecem prin fiecare curs activ și facem verificarea
        for (const schedule of activeSchedules) {
            const { count: scannedCount, error: attendanceError } = await supabase
                .from('attendance')
                .select('*', { count: 'exact', head: true })
                .eq('schedule_id', schedule.id);
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('persoane_prezente')
                .eq('id', schedule.room_id)
                .single();

            if (attendanceError || roomError || !roomData) continue;

            const persoaneFizice = roomData.persoane_prezente || 0;
            const studentiScanati = scannedCount || 0;

            // 3. LOGICA DE DETECȚIE A FRAUDEI
            if (studentiScanati > persoaneFizice) {

                // Extragem datele profesorului pentru notificare
                const { data: profData } = await supabase
                    .from('profiles')
                    .select('full_name, email')
                    .eq('id', schedule.profesor_id)
                    .single();
                alerts.push({
                    room: schedule.room_id,
                    materie: schedule.materie,
                    profesor: profData?.full_name || 'Necunoscut',
                    prof_email: profData?.email,
                    scanned: studentiScanati,
                    physical: persoaneFizice,
                    message: `FRAUDĂ DETECTATĂ: S-au scanat ${studentiScanati} carduri, dar în sală sunt doar ${persoaneFizice} persoane!`
                });

            }
        }
        return NextResponse.json({
            status: 'ok',
            fraud_alerts: alerts
        }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: 'A apărut o eroare de server' }, { status: 500 });
    }
}