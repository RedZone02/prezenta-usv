import { Suspense } from "react";
import DisplayClient from "./DisplayClient";

export default function DisplayPage() {
    return (
        <Suspense fallback={<div>Se încarcă...</div>}>
            <DisplayClient />
        </Suspense>
    );
}