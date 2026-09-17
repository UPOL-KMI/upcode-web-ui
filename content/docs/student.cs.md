> [!WARNING]
> **Beta verze.** Aplikace i tato dokumentace se stále vyvíjejí a jejich obsah bude průběžně
> upravován.

Tato část dokumentace popisuje možnosti přihlášení do systému z pohledu studenta, zapojení se do
kurzů, odevzdávání řešení a vyhodnocování úloh.

## Přihlášení a uživatelský účet

Do systému se přihlaste pomocí školního účtu, pokud je tato možnost na přihlašovací stránce dostupná
(plánováno od Q1/2027). V opačném případě musíte požádat některého vyučujícího, aby vám zaslal
pozvánku k registraci do systému. **Manuální registrace není v současné době povolena.**

Pozvánka přijde e-mailem a má omezenou platnost; datum je uvedeno v e-mailu i na stránce, kterou
odkaz otevře. Po vypršení požádejte o novou — prodloužit původní nelze. Po otevření odkazu si nastavte
heslo k účtu a odesláním formuláře vám bude účet založen.

Zapomenuté heslo obnovíte odkazem **Nepamatuji si heslo** na přihlašovací stránce. To platí pouze
pro účty s vlastním heslem; u školního účtu heslo spravuje škola.

E-mailovou adresu potvrďte odkazem, který vám po vytvoření účtu dorazí do schránky. Systém na
e-mail posílá upozornění na blížící se termíny, výsledky vyhodnocení a dokončené revize. Dokud
adresa není potvrzená, e-maily nebudou zasílány.

## Zápis do kurzu

Zápis do kurzu probíhá (po přihlášení) dvěma způsoby v závislosti na nastavení viditelnosti kurzu:

1. Otevřete v menu položku **Moje skupiny → Všechny skupiny** a pokuste se kurz vyhledat.
   V kladném případě otevřete detail kurzu a klikněte na tlačítko **Vstoupit do skupiny**.
2. V opačném případě je nutné požádat vyučujícího o přímé přidání do kurzu, nebo o zaslání odkazu
   pro otevření zápisu.

Zda můžete kurz opustit sami, je na nastavení konkrétního kurzu: buď v detailu kurzu naleznete
tlačítko **Opustit skupinu**, nebo je v informacích o kurzu uvedeno, že studenti skupinu opustit
sami nemohou. Ve druhém případě je nutné požádat vyučujícího o odepsání ze skupiny. Odevzdaná
řešení zůstávají zachována i po opuštění skupiny.

## Kurzy a termíny

Po přihlášení do systému má student k dispozici **Přehled**, který obsahuje:

- **Blížící se termíny** — úlohy otevřené k odevzdání, seřazené podle nejbližšího termínu. U každé
  je uveden kurz, termín, maximální počet bodů a aktuální stav odevzdání.
- **Kalendář** — měsíční přehled týchž termínů, listovatelný po měsících.
- **Hodnoceno bez odevzdání** — práce, kterou systém nevyhodnocuje (ústní zkouška, prezentace,
  docházka). Body uděluje vyučující ručně a uvedený termín je pouze informativní.
- **Můj postup** — průběžné bodové hodnocení v jednotlivých kurzech, včetně hranice pro splnění,
  je-li nastavena.

V části menu **Moje skupiny** jsou zobrazeny běžící kurzy, do kterých je student zařazen. V záložce
**Všechny skupiny** mohou být vidět i veřejné skupiny, do kterých se může student volitelně přidat.

## Odevzdání řešení

Před odevzdáním řešení si u úlohy pečlivě zkontrolujte zadání a podmínky, zejména termín odevzdání,
počet bodů, maximální počet pokusů a podporované programovací jazyky pro odevzdání řešení.

Po výběru možnosti **Odevzdat řešení** postupujte následovně:

1. Nahrajte soubory obsahující řešení. Nad formulářem je uveden maximální povolený počet souborů
   a jejich velikost.
2. Pokud úloha podporuje více programovacích jazyků, vyberte jazyk použitého řešení. Nabídka se
   odvozuje z názvů nahraných souborů; u úlohy s jediným jazykem se pole nezobrazuje.
3. Pokud řešení obsahuje více souborů, určete v poli **Spouštěný soubor** vstupní soubor programu.
   Bez této volby nelze řešení odevzdat, a to záměrně: výchozí volba podle abecedy by často spustila
   nesprávný soubor a výsledkem by bylo nula bodů, které vypadají jako chyba v řešení.
4. Nepovinně připojte **Poznámku**. Vidíte ji pouze vy a vyučující daného kurzu.
5. Odevzdání potvrďte tlačítkem **Odevzdat**.

**Zda lze odevzdat archiv, závisí na konkrétní úloze.** Systém páruje nahrané soubory podle jejich
názvu proti vzoru uvedenému v konfiguraci úlohy — očekává-li úloha například `*.py`, archiv tomuto
vzoru nevyhovuje a odevzdání je odmítnuto. Nejste-li si jisti, odevzdejte jednotlivé zdrojové
soubory.

Po odevzdání systém řešení automaticky zpracuje a zahájí jeho vyhodnocování. U standardních
programovacích úloh trvá vyhodnocení zpravidla jednotky sekund. Průběh vyhodnocení není nutné ručně
obnovovat; výsledný stav se zobrazí automaticky po dokončení vyhodnocení.

## Úlohy bez automatického vyhodnocení

Úloha nemusí obsahovat program určený k automatickému vyhodnocení. Vyučující může požadovat například
textový dokument, naměřená data, prezentaci nebo dokument PDF.

Postup odevzdání je v takovém případě shodný. Odevzdaný soubor však systém automaticky nezpracovává:
řešení dostane stav **Čeká na hodnocení** a nula bodů. Po přijetí řešení provede vyučující kontrolu
a přiřadí počet získaných bodů studentovi ručně.

Termín odevzdání, maximální počet pokusů a případná zpětná vazba jsou řízeny stejným způsobem jako
u automaticky vyhodnocovaných úloh.

## Výsledek vyhodnocení

Po dokončení vyhodnocení systém zobrazí získané skóre a výsledky jednotlivých testů.

U každého testu je uveden jeho výsledek, dosažené skóre, spotřebovaný čas a paměť, jak blízko byly
nastaveným limitům, a návratový kód programu.

| Výsledek                   | Význam                                                                 |
| -------------------------- | ---------------------------------------------------------------------- |
| **Prošel**                 | Řešení testem úspěšně prošlo.                                          |
| **Neprošel**               | Program byl spuštěn, ale jeho výstup neodpovídal očekávanému výsledku. |
| **Přeskočen**              | Test nebyl spuštěn, protože selhal některý z předchozích kroků.        |
| **Překročen časový limit** | Běh programu překročil stanovený časový limit.                         |
| **Překročen limit CPU**    | Program překročil limit procesorového času.                            |
| **Překročen limit paměti** | Program překročil stanovený limit využití paměti.                      |

Celý pokus může navíc skončit v některém z těchto stavů:

| Stav                                               | Význam                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Správně / Částečně správně / Špatně** (auto)     | Hodnocení bylo spočítáno z testů. Vyučující je může následně změnit.                             |
| **Chyba překladu**                                 | Řešení se nepodařilo přeložit, neproběhl žádný test. Výstup překladače je k dispozici v systému. |
| **Vyhodnocení selhalo**                            | Selhal vyhodnocovací systém, nikoli vaše řešení. Nespotřebuje to pokus.                          |
| **Čeká na hodnocení**                              | Úloha se nevyhodnocuje automaticky; body udělí vyučující.                                        |
| **Ohodnoceno vyučujícím**, **Body od vyučujícího** | Bodové hodnocení nastavil vyučující namísto automatického výpočtu.                               |
| **Bez bodování**                                   | Za tuto úlohu se body neudělují.                                                                 |

Celkové skóre je vypočítáno na základě úspěšnosti jednotlivých testů a jejich váhy; vyučující může
namísto vážení použít i vlastní vzorec. Částečně správné řešení proto může získat poměrnou část
bodového hodnocení.

U testů, které nebyly úspěšné, lze porovnat očekávaný a skutečný výstup programu — slouží k tomu
**Výstup soudce**, který uvádí rozdíly řádek po řádku a obsahuje vysvětlivku použitého zápisu. Rozsah
skutečného výstupu zobrazeného studentovi je určen nastavením konkrétní úlohy vyučujícím.

V případě neúspěšného automatického hodnocení si nejprve pečlivě zkontrolujte zadání a zda ho vaše
úloha kompletně řeší. Pokud si nejste jisti chybou, požádejte u úlohy o revizi vyučujícím, nebo
s ním problém vyřešte ve vyhrazeném čase — během cvičení nebo v konzultačních hodinách. Pokud si
naopak jste chyby vědomi a řešení jste opravili, můžete nahrát (až do nastaveného limitu) nové
řešení, které bude opět automaticky vyhodnoceno.

**Zpravidla se do hodnocení počítá řešení s nejvyšším dosaženým skóre, pokud vyučující nerozhodne
jinak.** Přesné pořadí pravidel je toto: označil-li vyučující některé řešení jako **Uznáno**, počítá
se to; jinak řešení s nejvyšším počtem bodů; a při shodě bodů to novější. Odevzdáním dalšího pokusu
si tedy hodnocení nezhoršíte, spotřebujete ale jeden pokus.

## Termíny a počet pokusů

Zadání může mít nastaveno druhý (pozdní) termín odevzdání za snížený počet bodů.

Je-li počet pokusů odevzdání řešení omezen, obrazovka zadání uvádí, kolik vám jich ještě zbývá. Před
odevzdáním si řešení ověřte na příkladu ze zadání. **Jak přísně se výstup porovnává, určuje soudce
zvolený v konkrétní úloze**: některé porovnávají výstup znak po znaku včetně bílých znaků, jiné
ignorují pořadí slov na řádku nebo pořadí celých řádků.

## Žádost o revizi

Na obrazovce řešení lze požádat vyučujícího o revizi. Řešení se tím zařadí do jeho fronty
a vyučující bude informován; žádost je možné vzít kdykoliv zpět.

Revize je sada komentářů — buď ke konkrétním řádkům odevzdaného řešení, nebo k řešení jako celku.
Komentář označený jako **připomínka k vyřešení** je nedostatek, jehož opravu po vás vyučující
požaduje. Komentáře se zobrazí až ve chvíli, kdy vyučující revizi uzavře.

## Zkouškový režim

Po dobu zkoušky vás vyučující může zamknout do jednoho kurzu. Dokud zámek trvá, ostatní kurzy nejsou
přístupné a pozvánkový odkaz do jiné skupiny je odmítnut; po skončení zkoušky se zámek uvolní sám.

## Řešení potíží

- **Vyhodnocení skončilo chybou infrastruktury.** Není to chyba vašeho řešení a nespotřebuje to
  pokus. Ohlaste to vyučujícímu; opětovné odevzdání nemá smysl, dokud není příčina odstraněna.
- **Řešení považujete za správné, ale test neprošel.** Přečtěte si Výstup soudce a ověřte přesné
  znění výstupu, poté požádejte o revizi a uveďte, v čem podle vás test chybuje.
- **Odevzdání nelze provést.** Uplynul termín, vyčerpali jste pokusy, kurz už řešení nepřijímá, nebo
  je odevzdávání dočasně vypnuté na celé instanci. Obrazovka zadání uvádí konkrétní důvod.
- **Nechodí e-mailová oznámení.** Zkontrolujte, zda je vaše adresa potvrzená; na nepotvrzenou adresu
  systém neposílá nic.
- **V případě dotazů** můžete ke každému zadání napsat příspěvek do diskuze. Pokud máte dotaz
  k vyhodnocení svého konkrétního řešení, zahajte diskuzi přímo v detailu odevzdaného pokusu.
