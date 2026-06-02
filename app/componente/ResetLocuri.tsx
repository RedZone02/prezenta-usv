import { SupabaseClient } from '@supabase/supabase-js'

export async function resetSeatsIfNoClass(
    supabase: SupabaseClient,
    roomId: string,
    getSaptamana: () => 'par' | 'impar'
) {
    const acum = new Date()
    const bucuresti = new Date(acum.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }))
    const ziAzi = bucuresti.getDay() === 0 ? 7 : bucuresti.getDay()
    const ora = String(bucuresti.getHours()).padStart(2, '0')
    const min = String(bucuresti.getMinutes()).padStart(2, '0')
    const oraAzi = `${ora}:${min}:00`
    const saptamana = getSaptamana()

    const { data: activa } = await supabase
        .from('schedule')
        .select('id')
        .eq('room_id', roomId)
        .eq('zi', ziAzi)
        .lte('ora_start', oraAzi)
        .gte('ora_end', oraAzi)
        .or(`saptamana.is.null,saptamana.eq.${saptamana}`)
        .single()

    if (!activa) {
        const { data: ocupate } = await supabase
            .from('room_seats')
            .select('id')
            .eq('room_id', roomId)
            .eq('ocupat', true)

        if (ocupate && ocupate.length > 0) {
            await supabase
                .from('room_seats')
                .update({ ocupat: false, rezervat: false, student_id: null })
                .eq('room_id', roomId)
        }
    }
}