const EXPLANATIONS: Record<number, string> = {
	10: "10 Minuten sind ein kleiner Anfang: Wiederhole eine Karteikarte oder eine kurze Aufgabe.",
	20: "20 Minuten geben dir Zeit für einen überschaubaren Lernschritt. Konzentriere dich auf ein Thema.",
	15: "15 Minuten reichen für einen kleinen Lernschritt: Wiederhole Vokabeln oder übe eine Aufgabe. Plane dir dafür regelmäßig Zeit ein.",
	30: "In 30 Minuten kannst du dich auf ein Thema konzentrieren und passende Aufgaben üben. Ein überschaubarer Lernschritt für deinen Alltag.",
	45: "45 Minuten geben dir Zeit, ein Thema zu verstehen und das Gelernte direkt anzuwenden. Konzentriere dich auf ein klares Ziel.",
	60: "60 Minuten bieten Platz zum Verstehen, Üben und Wiederholen. Gönn dir zwischendurch eine kurze Pause.",
	90: "90 Minuten lassen sich in mehrere kurze Lernabschnitte aufteilen. Wechsle zwischen Verstehen und Üben und plane Pausen ein.",
	120: "120 Minuten – also 2 Stunden – geben dir Raum für mehrere Themen. Teile die Zeit in überschaubare Abschnitte mit Pausen auf.",
	150: "150 Minuten lassen sich in mehrere Lernabschnitte mit Pausen aufteilen. Setze dir für jeden Abschnitt ein klares Ziel.",
	180: "180 Minuten – also 3 Stunden – sind ein großes Zeitfenster. Lerne in kurzen Abschnitten und nimm dir dazwischen bewusst Zeit für Pausen.",
	210: "210 Minuten sind ein großes Zeitfenster. Teile es in überschaubare Lernabschnitte mit ausreichend Pausen auf.",
	240: "240 Minuten – also 4 Stunden – müssen kein Lernmarathon sein. Teile dein Zeitfenster in kleinere Lernabschnitte mit ausreichend Pausen auf.",
};

export const getStudyTimeFactBody = (studyTime: string) =>
	EXPLANATIONS[Number.parseInt(studyTime, 10)] ?? EXPLANATIONS[30];
