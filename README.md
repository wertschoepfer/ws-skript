# WS-Skript
Das WS-Skirpt ist ein JavaScript Modul/Framework (???), das einen struktieriteren und objektorientierteren Ansatz der JavaScript Entwicklung im JobRouter ermöglicht. Es besteht aus einem großen Javascript Objekt "WS", dessen  Grundfunktionalitäten in der "ws.js" Datei verankert sind. Das WS.datamodel Property ist hingegen ausgelagert in das seperate Skript "ws-datamodel.js". 

# Installation
Die Skripte können über einen seperaten Prozess im Jobrouter abgelegt werden. Hierzu erstellen wir einen Prozess und benennen diesen in unserem Beispiel "ws_utils". Sie können den Namen beliebig wählen. Um nun das Skript in den Prozess zu bekommen, müssen Sie direkt über den Server, auf dem sich Ihr JobRouter befindet, in der Ordnerstruktur in den Data Ordner Ihres Prozesses ( data/[process-name]/[process-version]/ ). In diesem Ordner sollten die Dateien aus diesem Repository hinzugefügt werden. 

Um das Skript nun in einem Prozess zu verwenden, ganz einfach im Dialogeditor unter Skripten ein externes JavaScript einbinden und den Pfad angeben unter welchem das Skirpt zu finden ist. ( data/[process-name]/[process-version]/ws/global/js/ws.js ). 

Analog für das datamodel verfahren. 

WICHTIG! Wir empfehlen:
- die beiden Skripte als globale Skripte einzubinden
- Zuerst das WS Skript und dann das datamodel einbinden 

# Documentation
In diesem Abschnitt wird erläutert wie das Skirpt benutzt wird.

## Grundsätzliche Struktur
Die generelle Idee des Skriptes ist, dass in der onLoad Funktion die Methode "WS.createDatamodel({ object })" aufgerufen wird. In diesem Methodenaufruf werden durch parsen des DOMs des geladenen Dialogs alle Dialogelement in Objekte überführt. Diese Objekte werden in ein großes Objekt gespeichert, welches von der Methode zurückgegeben wird. Dieses Objekt nennen wir "Model" und speichern es in eine gleichnamige Variable. Der Zugriff auf ein Dialogelement erfolgt nun über den im Dialogeditor vergeben Namen als Property in dem abgespeicherten Element (z.b. Model.customerName). 

Im nächsten Unter Abschnitt erklären wir wozu das im Methoden aufruf übergeben Objekt dient und wie dessen Struktur auszusehen hat

## Das Objekt eines Dialogelements
Jedes Dialogelement wird durch ein Objekt im Model repräsentiert und kann wie oben beschrieben angesprochen werden. Ein Dialogelement hat abhängig von dessen Typ bestimmte Properties. So hat beispielsweise jedes Dialogelement das Property 'visible' womit dessen Sichtbarkeit manipuliert werden kann und wird folgendermaßen benutzt:

Model.dialogElementName.visible = false;  // ( = true; )

Im Vergleich dazu wäre die JobRouter eigene Variante:

jr_set_visible('dialogElementName', false); // ( , true); )

Ein Property, dass beispielsweise bei List-Elementen nicht existiert ist das Property 'readonly'. 

Das Auslesen des Wertes eines der Properties erfolgt nun einfach über:

var visibilty = Model.dialogElementName.visible;

anstelle von

var visibilty jr_is_visible('dialogElementName');

Oder Beispielhaft gezeigt am Beispiel des Wertes eines Dialogelements (insofern dieses einen besitzt):

Model.textBox.value = 'Ein neuer Wert wurde gesetzt';
anstelle von: jr_set_value('textBox', 'Ein neuer Wert wurde gesetzt');

Und

var wert = Model.textBox.value;
anstelle von: var wert = jr_get_value('textBox');

Im Folgenden wird genauer auf besondere Elemente eingegangen 
### Untertabellen



## Konfigurationsobjekt
Das Objekt, das im vorherigen Abschnitt dem Methodenaufruf "WS.createDatamodel({ object })" übergeben wurde, dient der Konfiguration der Dialogelement und füllt das Model mit Leben. Zuerst werden wir die Strukur des Objekts erläutern und danach detailierter auf die konkreten einzelnen Elemente einzugehen.

Die Methode erwartet folgende Struktur des Konfigurationsobjekts: 

{
    renderers : {},
    listeners : {},
    dependencies : {}
}

Im Folgenden wird auf diese drei Konfigurationsoptionen detailierter eingegangen. 

### Renderers
Die Konfigurationsoption 'renderers' enthält alle Renderer für diesen Dialog. Ein Renderer ist eine Funktion, die für ein Dialogemelent definiert werden kann und in festdefiniert Situationen aufgerufen wird. Der Situationstyp des Aufrufs wird der Funktion als Parameter übergeben und mit 'type' bezeichnet. 

Das sind die verschiedenen Typen und deren Situationen:
- 'load' = einmal beim initialen Laden des Dialogs
- 'value' = bei Änderung des Wertes eines Dialogelements. 
- 'disabled' = wenn der Wert von disabled gestetzt wird. (unabhängig von Wertänderung). 
- 'visible' = wenn der Wert von visible gestetzt wird. (unabhängig von Wertänderung).
- 'readonly' = wenn der Wert von readonly gestetzt wird. (unabhängig von Wertänderung). 
- 'dependency' = wenn der Renderer eines Dialogelements aufgerufen wird, von dem aus eine Abhängigkeit auf dieses Dialogelement existiert. 
 ACHTUNG! : dieser Typ existiert derzeit nicht bei SQL-Elementen. Diese werden stattdessen mit dem Typ 'refresh' aufgerufen     
- 'refresh' = existiert nur bei SQL-Elementen und wird aufgerufen, wenn ein dieses manuell durch .refresh() ausgeführt wurde oder aufgrund einer Abhängigkeit auf ein anderes Element, dessen Renderer aufgerufen wurde.   



renderers : {
    dialogelementName : function (model, type, initType) {
    
    },
    
    dialogelementName2 : function (model, type, initType) {

    }
},



Das Konfigurationsobjekts besteht aus 3 Bestandteilen.   Fehlt eines dieser Properties, wird dieses Standardmäßig mit einem leeren Objekt initialisiert.

{
    
    listeners : {
        dialogelementName : {
            click : function () {

            }
        },
        dialogelementName2 : {
            blur : function () {
                
            }
        }
    },
    dependencies : {
        dialogelementName : ["dialogelementName2"]
    }
} 




## Renderer

# Cotribution

# FAQ
