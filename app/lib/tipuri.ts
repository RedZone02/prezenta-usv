export type Loc = {
    id: string
    numar: number
    ocupat: boolean
    rezervat?: boolean
}

export type Orar = {
    ora: string
    materie: string
    profesor: string
    grupa: string
}

export type Sala = {
    id: string
    nume: string
    randuri: number
    coloane: number
    locuri: Loc[]
    orar: Orar
}

export type Corp = {
    id: string
    nume: string
    sali: Sala[]
}