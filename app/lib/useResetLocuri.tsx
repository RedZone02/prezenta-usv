import { useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { resetSeatsIfNoClass } from '../componente/ResetLocuri'
import { getSaptamana } from './date'

export function useAutoResetSeats(
    supabase: SupabaseClient,
    roomId: string | null
) {
    useEffect(() => {
        if (!roomId) return
        resetSeatsIfNoClass(supabase, roomId, getSaptamana)
        const interval = setInterval(() => {
            resetSeatsIfNoClass(supabase, roomId, getSaptamana)
        }, 60 * 1000)
        return () => clearInterval(interval)
    }, [roomId])
}