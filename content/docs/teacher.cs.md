> [!WARNING]
> **Beta verze.** Aplikace i tato dokumentace se stále vyvíjejí a jejich obsah bude průběžně
> upravován.

Tato část dokumentace popisuje založení kurzu z pohledu vyučujícího, přípravu úloh, jejich zadání
studentům, průběžné hodnocení odevzdaných řešení a vedení zkoušky.

## Základní pojmy

Systém pracuje se čtyřmi pojmy a veškerá další nastavení jsou podrobnostmi některého z nich.

- **Skupina** je kurz nebo seminární skupina uvnitř kurzu. Sdružuje studenty a zadání a může
  obsahovat podskupiny.
- **Úloha** je definovaná svým zadáním, (volitelně) testy, vzorovým řešením a nastavením omezení
  zdrojů. Úlohy jsou uloženy v katalogu nezávisle na kurzech a dají se dle nastavených práv zadávat
  do libovolné skupiny.
- **Zadání** je konkrétní úloha přiřazená konkrétní skupině, s vlastními termíny a bodovým
  ohodnocením. Tutéž úlohu lze zadat v libovolném počtu kurzů a v každém nastavit jiné termíny.
- **Řešení** je jeden pokus jednoho studenta vztažený k jednomu zadání. Systém jej může automaticky
  vyhodnotit a obodovat a vyučující může výsledné hodnocení změnit.

Zásadní je rozdíl mezi úlohou a zadáním: **úlohu připravíte jednou a zadáte ji opakovaně.** Pozdější
úprava úlohy neovlivní kurzy, ve kterých je již zadána, dokud synchronizaci sami nevyvoláte.

## Založení kurzu a budoucí archivace

Kurz založíte v sekci **Skupiny**. Povinný je název alespoň v jednom jazyce rozhraní (česky nebo
anglicky); druhý můžete doplnit později.

Chování kurzu určují tři možnosti nastavení druhu skupiny:

- **Organizační** — mohou obsahovat další skupiny, ale neobsahují žádné studenty ani zadání.
- **Běžná** — jako organizační, ale lze do této skupiny zadávat zadání úloh a přidávat studenty.
- **Zkoušková** — příznak běžné skupiny určený pro skupinu, ve které se koná zkouška. Má tři
  důsledky: zadání vytvořená v takové skupině se automaticky označí jako zkoušková a studentovi se
  po dobu konání zkoušky zobrazí pouze tehdy, je-li do skupiny zamčen; studenti skupinu nemohou
  opustit sami; a skupina nemůže obsahovat podskupiny. Zkouškovou skupinu nelze zároveň označit
  jako organizační.

Nezávisle na druhu lze skupinu označit jako **veřejnou**, což znamená, že se do ní studenti mohou
zapsat sami, bez zásahu vyučujícího.

Po skončení semestru nebo akademického roku lze neaktivní skupiny archivovat. K archivovaným
skupinám se lze v budoucnu vracet, ale tyto skupiny studentům i vyučujícím zmizí ze seznamu
aktivních kurzů.

Studenty lze do kurzu zařadit třemi způsoby: zapíší se sami, je-li kurz veřejný; přidáte je ručně ze
seznamu uživatelů; nebo jim zašlete **pozvánkový odkaz** s omezenou platností. Odkazy spravujete
v detailu kurzu a u každého je vidět, kdo jej vystavil a do kdy platí.

V nastavení kurzu dále určíte, zda mohou studenti skupinu opustit sami, a zda se jim zobrazují
souhrnné statistiky skupiny.

## Příprava úlohy

Novou úlohu založíte v sekci **Úlohy**. Než ji bude možné zadat, musí být její konfigurace úplná;
dokud není, systém ji označí za nekompletní a uvede konkrétní důvod — chybějící text, žádné testy,
nenastavený způsob výpočtu úspěšnosti, nevybraný programovací jazyk, neúplná konfigurace testů
nebo chybné
limity.

1. **Text zadání.** Zapisuje se v Markdownu, a to zvlášť pro každý jazyk, ve kterém chcete zadání
   nabídnout — tedy česky, anglicky, nebo obojí. Vykreslují se i bloky kódu a matematické výrazy
   zapsané pomocí `$...$` a `$$...$$`.
2. **Testy.** Každý test určuje, co vstupuje do programu a jaký výstup se očekává. Porovnání provádí
   vestavěný soudce; podle zvoleného soudce se výstup porovnává znak po znaku, nebo bez ohledu na
   pořadí slov na řádku či pořadí celých řádků.
3. **Limity.** Časový a paměťový limit je nutné nastavit pro každý test a každý programovací
   jazyk. Vyjděte z hodnot naměřených u referenčního řešení a ponechte dostatečnou rezervu — stroj,
   který úlohy vyhodnocuje, nemá výkon studentova notebooku.
4. **Referenční řešení.** Správné řešení, které odevzdáte sami. Není sice technicky vyžadováno
   k zadání úlohy, ale **je jediným způsobem, jak si ověřit, že testy, limity a konfigurace spolu
   skutečně fungují**, a projeví se na něm většina chyb v nastavení.

Referenční řešení odevzdejte a přečtěte si jeho výsledek dříve, než úlohu zadáte studentům.
Nezíská-li plný počet bodů, úloha není připravena — na tutéž překážku by narazil každý student.

### Úlohy bez automatického vyhodnocení

Ne každou práci lze spustit a otestovat. Pro eseje, naměřená data, prezentace nebo skenované
dokumenty slouží prostředí **Data-Only**, které se volí mezi programovacími jazyky úlohy, v sekci
**Jazyky**. Přijímá libovolný
soubor bez ohledu na příponu, nic nepřekládá ani nespouští a nemá testy ani limity — konfigurace
úlohy se proto omezí na samotný text zadání.

Odevzdané řešení dostane stav **Čeká na hodnocení** a nula bodů. Body udělíte ručně na obrazovce
řešení; teprve tím se řešení považuje za ohodnocené. Do doby, než tak učiníte, systém studentovi
žádný verdikt netvrdí.

Prostředí Data-Only nelze v jedné úloze kombinovat s žádným programovacím jazykem; rozhraní na to
upozorní.

### Import z GitHub Classroom (beta)

Zadání obsahující soubor `autograding.json` lze naimportovat namísto ručního přepisování. Testy typu
`input` a `output` se převedou na testy v systému, soubor `README.md` ze šablony se stane textem
úlohy a ostatní soubory přílohami.

Co převést nelze, import výslovně uvede: test spouštějící libovolný příkaz shellu ani celý testovací
framework uvnitř repozitáře se na dvojice vstup/výstup převést nedají. Šablona z Classroomu navíc
prakticky nikdy neobsahuje referenční řešení, takže je nutné je doplnit.

## Zadání úlohy studentům

V detailu kurzu zvolte možnost zadání úlohy. Výběr začíná u úloh vašeho kurzu a lze jej rozšířit na
celý katalog.

Následně nastavíte podmínky:

- **První termín** a počet bodů platný do jeho uplynutí.
- **Druhý termín**, volitelně, se sníženým počtem bodů. Bodové ohodnocení může po prvním termínu
  klesnout skokově, nebo se mezi oběma termíny snižovat plynule.
- **Bodový práh** — jakou část bodů musí řešení získat, aby se studentovi vůbec započítalo.
- **Limit pokusů** — kolikrát smí student odevzdat. Nejde-li o zkoušku, doporučujeme jej nastavit
  velkoryse.
- **Viditelné od** — zadání existuje, ale studentům se do uvedeného okamžiku nezobrazí.
- **Povolené programovací jazyky**, ve kterých smí student odevzdávat.

Termíny zadáváte ve své časové zóně a každému uživateli se zobrazí v zóně jeho vlastní.

Upravíte-li úlohu poté, co již byla zadána, změna se do existujících zadání nepromítne sama.
Zadání drží vlastní kopii konfigurace a je nutné vyvolat jeho synchronizaci s úlohou.

## Hodnocení odevzdaných řešení

Záložka **Řešení** u zadání vypisuje jednotlivé pokusy, jeden řádek na odevzdání. Po otevření
konkrétního řešení uvidíte odevzdané soubory, výsledek každého testu a způsob, jakým bylo vypočteno
bodové skóre řešení. Z odevzdaných řešení jednoho studenta je vždy vybráno jen jedno, jehož body se
započítávají do celkového hodnocení.

Z obrazovky řešení lze provést následující:

- **Upravit počet bodů.** Automatické hodnocení přepíšete vlastním, s poznámkou o důvodu. Využijete
  je u řešení, které je správné způsobem, jejž testy nezachytí, nebo naopak chybné způsobem, který
  jim unikl.
- **Uznat pokus.** Uznané řešení se do hodnocení započítá přednostně, i kdyby jiný pokus získal více
  bodů.
- **Napsat revizi.** Komentáře ke konkrétním řádkům kódu, případně k řešení jako celku. Komentář lze
  označit jako připomínku k vyřešení. **Revize zůstává studentovi skrytá, dokud ji neuzavřete.**
- **Přehodnotit řešení.** Spustí testy znovu, například po opravě chybně nastavené úlohy.
- **Porovnat dva pokusy** řádek po řádku a zjistit, co se mezi nimi změnilo.

Bez zásahu vyučujícího se do hodnocení započítává řešení s nejvyšším počtem bodů, nikoli poslední
odevzdané. Při shodném počtu bodů rozhoduje novější pokus. Uznáte-li některé řešení, má přednost
před oběma pravidly.

Studenti mohou o revizi požádat sami. Žádosti se shromažďují na vašem přehledu, takže fronta
neuzavřených revizí je místem, kam se stačí podívat.

## Přehled o celém kurzu

Záložka **Studenti** zobrazuje bodovou matici: každý student proti každému zadání, včetně součtů.
Matici lze exportovat a z každé buňky vede odkaz na pokusy daného studenta.

Každý student má v rámci kurzu vlastní obrazovku se všemi svými odevzdanými řešeními na jednom
místě. Bývá nejrychlejší odpovědí na otázku, jak si konkrétní člověk v kurzu vede.

## Body udělované bez odevzdání

**Stínové zadání** slouží k evidenci bodů za práci, kterou studenti neodevzdávají do systému — za
prezentaci, ústní zkoušení nebo aktivitu na semináři. Objeví se v bodování kurzu vedle běžných
zadání a body zadáváte sami, po jednotlivých studentech, spolu s datem, kdy byly uděleny.

Termín u stínového zadání je pouze informativní: systém podle něj nic nevynucuje a o tom, zda byl
dodržen, rozhodujete vy.

## Zkoušky

Kurz lze na zvolené období přepnout do zkouškového režimu. Zkouška začne okamžitě nebo v čase, který
určíte, trvá zadanou dobu nebo do zadaného konce a může studenty po tuto dobu zamknout do kurzu.
Zamčený student vidí během zkoušky pouze daný kurz a pozvánkové odkazy do jiných skupin jsou po tu
dobu odmítány.

Zkouškový režim nastavte dříve, než se místnost zaplní. Záložka **Zkoušky** ukazuje průběh, seznam
zamčených studentů a záznamy o dříve proběhlých zkouškách; jednotlivé studenty lze v případě potřeby
uvolnit.
