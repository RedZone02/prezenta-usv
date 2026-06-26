"use client"
import React from 'react';
import styles from './module_css/FraudAlert.module.css'

interface FraudAlertProps {
    studentiScanati: number;
    persoaneFizice: number;
}

export default function FraudAlert({ studentiScanati, persoaneFizice }: FraudAlertProps) {
    const esteFrauda = studentiScanati > persoaneFizice;

    // Dacă nu e fraudă, nu randăm nimic
    if (!esteFrauda) {
        return null;
    }

    return (
        <div className={styles.alertContainer}>
            <div className={styles.iconWrapper}>
                <svg className={styles.icon} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
            </div>
            <div className={styles.textWrapper}>
                <h3 className={styles.title}>
                    Atenție: Posibilă validare multiplă (Buddy Punching)
                </h3>
                <p className={styles.description}>
                    Sistemul a înregistrat <strong>{studentiScanati}</strong> studenți prezenți, dar senzorii de la ușă raportează doar <strong>{persoaneFizice}</strong> persoane în sală.
                </p>
            </div>
        </div>
    );
}