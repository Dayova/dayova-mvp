# Von Philipp bereitgestellte Abschlussdokumentation

Die fünf PNGs sind unveränderte Originale vom 03.10.2026. Die komplette 27,01-Sekunden-Aufnahme ist als GIF mit 12 Bildern/Sekunde und 480 Pixel Breite eingebettet, ohne Kürzung oder Änderung der Abspielgeschwindigkeit. Das Original ist stumm. Die Animation ist ein Darstellungsformat für GitHub, kein Framerate-Benchmark.

- overview-top.png / overview-bottom.png: Ergebnis, Lerntermine, Hinzufügen und Übernehmen.
- more-time.png / less-time.png: Bestätigung abweichender Lernzeiten.
- editor-before-delete-color.png: Aufnahme 20:44, Zwischenstand vor Anpassung der Löschfarbe; der aktuelle Entfernen-Button hat zusätzlich roten Rand und hellroten Hintergrund.
- learning-times-demo.gif: Aufnahme 20:51, Bearbeiten von Lerntag, Dauer und Beginn sowie Hinzufügen. Die später hinzugefügten Bestätigungen sind in den PNGs belegt.

## Videoauswertung

Coverage: 27.01-second video; 54 full-timeline frames sampled at 2 fps (0.5-second interval); 4 contact sheet(s); no audio stream.

Alle vier Kontaktbögen vollständig geprüft. 00:00–00:05: Übersicht, Editor und Änderung des Wochentags. 00:06–00:12: Lerndauerwahl, anschließend 55 Minuten im Editor und der Liste. 00:13–00:18: Uhrzeitwahl, anschließend Beginn 20:30 und Ende 21:00. 00:19–00:24: Scrollen, Hinzufügen und erneute Liste. 00:25–00:27: Rückkehr nach oben.

Kein Audiostream, keine Transkription. Abtastung alle 0,5 Sekunden, ohne Tap-Indikatoren: keine Aussage über genaue Eingabe-Latenz. Sichtbar sind lokale Terminänderungen, kein authentifiziertes Backend-Speichern oder vollständig absolvierter Wissenscheck. Im Video werden per Wochentagsauswahl auch vergangene Daten im lokalen Entwurf angezeigt; das ist kein Nachweis serverseitig akzeptierter Termine. Diese Medien reichen für die visuelle Dokumentation der gezeigten Oberflächen, nicht für eine vollständige Ende-zu-Ende-Abnahme.

## Originalvideos

`learning-times-demo.mp4` ist die unveränderte vollständige 27,01-Sekunden-Aufnahme, nun zusätzlich als echter Videoplayer im PR eingebettet. `jakob-review-single-frame.mp4` ist die zusätzlich bereitgestellte unveränderte Datei von 20:57:14: laut ffprobe ein H.264-Videoframe, Dauer 0,066667 Sekunden, kein Audiostream. Die automatische Kontaktbogen-Erzeugung liefert für diesen sehr kurzen Clip keine Frames; der einzige Frame wurde direkt mit ffmpeg extrahiert. Kein Ablaufnachweis aus dieser Datei.
