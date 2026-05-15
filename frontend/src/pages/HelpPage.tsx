import { BookOpen, FileText, Wrench, Package, Users, Car, Clock, AlertTriangle, Download, RotateCcw, UserCheck, PenLine, CalendarDays, ShieldCheck } from 'lucide-react'
import { useTheme } from '@/lib/theme'

interface Section {
  icon: React.ReactNode
  color: string
  title: string
  steps: string[]
}

const sections: Section[] = [
  {
    icon: <FileText className="h-5 w-5" />,
    color: '#2761eb',
    title: 'Raport Dnia — pracownik',
    steps: [
      'Wejdź w zakładkę "Raporty" z menu bocznego.',
      'Kliknij "Nowy raport" — system automatycznie tworzy kontener na dzisiejszy dzień (lub otwiera istniejący przyciskiem "Edytuj dzisiejszy").',
      'Kliknij "Dodaj wpis". Każdy wpis to osobny blok roboczy: godziny od/do, lokalizacja, wydział (opcjonalnie) i opis.',
      'Jeśli korzystałeś z pojazdu: w formularzu wpisu dodaj wiersz pojazdu, wybierz tablice i wpisz przejechane kilometry.',
      'Możesz dodać wiele wpisów do jednego raportu — np. praca w różnych lokalizacjach lub na różnych projektach.',
      'Aby dodać materiały do wpisu: po zapisaniu wpisu pojawi się przycisk "Dodaj materiał" na karcie tego wpisu.',
      'Raport z bieżącego dnia możesz edytować do północy. Po północy wpisy są zablokowane (admin może odblokować na 24h).',
    ],
  },
  {
    icon: <PenLine className="h-5 w-5" />,
    color: '#0891b2',
    title: 'Sygnatury raportów — pracownik',
    steps: [
      'Możesz podpisać się pod raportem innego pracownika z bieżącego dnia — oznacza to, że pracowałeś razem z nim.',
      'Kliknij przycisk "Podpis" (niebieski) w widoku listy raportów.',
      'W oknie "Podpisz raport" wybierz raport kolegi i potwierdź.',
      'Podpisany raport pojawi się na Twojej liście z plakietką "Podpisany". Możesz do niego dodawać i edytować wpisy.',
      'Cofnięcie podpisu jest możliwe tylko tego samego dnia — kliknij "Cofnij" na karcie podpisanego raportu.',
      'Podpis można złożyć tylko pod raportem z dzisiejszego dnia i tylko raz pod ten sam raport.',
    ],
  },
  {
    icon: <Wrench className="h-5 w-5" />,
    color: '#7c3aed',
    title: 'Wypożyczalnia Sprzętu',
    steps: [
      'Wejdź w zakładkę "Sprzęt" z menu bocznego.',
      'Przeglądaj listę dostępnego sprzętu lub wyszukaj po nazwie.',
      'Przy wybranym sprzęcie kliknij "Wypożycz" — sprzęt przechodzi na Twoje konto.',
      'Swoje aktywne wypożyczenia znajdziesz w sekcji "Twoje wypożyczenia" (zielone karty).',
      'Aby oddać sprzęt: kliknij "Zwróć" przy swoim wypożyczeniu.',
      'Jeśli sprzęt jest uszkodzony lub nie działa: kliknij "Problem" przy swoim wypożyczeniu i opisz usterkę.',
      'Zgłosić problem można tylko ze sprzętu, który sam wypożyczyłeś.',
    ],
  },
  {
    icon: <Package className="h-5 w-5" />,
    color: '#059669',
    title: 'Materiałówka',
    steps: [
      'Wejdź w zakładkę "Materiałówka" z menu bocznego.',
      'Wyszukaj materiał (min. 3 znaki). Jeśli wyszukiwarka jest pusta — widoczna jest lista 30 ostatnio używanych.',
      'Kliknij w materiał, aby rozwinąć formularz pobrania.',
      'Wybierz raport z listy, następnie wybierz wpis (lokalizację) w ramach tego raportu.',
      'Podaj ilość i jednostkę, opcjonalnie dodaj uwagi, następnie kliknij "Pobierz".',
      'Jeśli widzisz, że materiału jest mało: zaznacz "Zgłoś niski stan", opcjonalnie zrób zdjęcie i kliknij "Pobierz".',
      'Materiały możesz też dodawać bezpośrednio z poziomu wpisu w raporcie — przycisk "Dodaj materiał" na karcie wpisu.',
      'Sekcja "Moje pobrania dziś" na dole pokazuje wszystko co pobrałeś dzisiaj. Możesz usunąć wpis klikając kosz.',
    ],
  },
  {
    icon: <UserCheck className="h-5 w-5" />,
    color: '#f59e0b',
    title: 'HR — urlopy i nieobecności',
    steps: [
      'Wejdź w zakładkę "HR" z menu bocznego.',
      'W sekcji "Saldo" sprawdzisz ile masz dostępnych dni urlopowych (pula 26 dni rocznie).',
      'Aby złożyć wniosek: kliknij "Złóż wniosek", wybierz typ urlopu, zakres dat i opcjonalnie dodaj uwagi.',
      'Dostępne typy: Urlop wypoczynkowy, Urlop na żądanie, Urlop okolicznościowy, L4, Urlop bezpłatny.',
      'L4 nie odlicza dni z puli urlopowej.',
      'Status wniosku znajdziesz na liście — oczekujący, zatwierdzony lub odrzucony (z komentarzem admina).',
      'Kalendarz miesięczny pokazuje Twoją obecność: zielony = przepracowany dzień, niebieski = urlop.',
    ],
  },
  {
    icon: <CalendarDays className="h-5 w-5" />,
    color: '#e11d48',
    title: 'HR — zarządzanie (admin)',
    steps: [
      'W zakładce "HR" admin widzi 4 taby: Wnioski / Salda / Obecność / Kalendarz zespołu.',
      'Tab "Wnioski": zatwierdź lub odrzuć wniosek urlopowy — możesz dodać komentarz przy odrzuceniu.',
      'Tab "Salda": przegląd sald wszystkich pracowników; możliwość ręcznego ustawienia limitu i dni przeniesionych.',
      'Tab "Obecność": tabela pracownicy × dni z godzinami (uwzględnia raporty własne i podpisane).',
      'Tab "Kalendarz zespołu": widok miesięczny z zaznaczonymi urlopami wszystkich pracowników.',
    ],
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    color: '#5b8ff5',
    title: 'Zarządzanie użytkownikami (admin)',
    steps: [
      'Wejdź w zakładkę "Użytkownicy" z menu bocznego (widoczna tylko dla administratora).',
      'Kliknij "Nowy użytkownik" i wypełnij dane: imię i nazwisko, login, hasło, rola.',
      'Aby edytować dane pracownika: kliknij ikonę ołówka przy jego nazwisku.',
      'Aby dezaktywować konto: kliknij ikonę przy pracowniku. Zdezaktywowany pracownik nie może się zalogować.',
      'Kolumna "Ostatnie logowanie" pokazuje kiedy pracownik ostatnio się logował.',
    ],
  },
  {
    icon: <Car className="h-5 w-5" />,
    color: '#0c7bb3',
    title: 'Pojazdy i flota (admin)',
    steps: [
      'Wejdź w zakładkę "Pojazdy" z menu bocznego (widoczna tylko dla administratora).',
      'Lista pokazuje wszystkie pojazdy z aktualnym stanem licznika (wyliczanym z ostatniego użycia).',
      'Aby skorygować stan licznika: edytuj pojazd i zmień wartość "Stan licznika (korekta)".',
      'Dezaktywowany pojazd nie pojawia się pracownikom na liście przy wypełnianiu raportu.',
      'Pracownicy w raporcie wpisują kilometry PRZEJECHANE danego dnia (nie odczyt z deski) — system wylicza aktualny przebieg.',
    ],
  },
]

const tips = [
  { icon: <Clock className="h-4 w-4" />,        text: 'Raport dnia możesz edytować tylko do północy — pamiętaj o wypełnieniu go przed końcem dnia. Admin może odblokować raport na 24h.' },
  { icon: <PenLine className="h-4 w-4" />,       text: 'Podpisując się pod raportem kolegi, zyskujesz pełny dostęp do jego edycji — możesz dodawać, edytować i usuwać wpisy.' },
  { icon: <AlertTriangle className="h-4 w-4" />, text: 'Zgłoszenia niskiego stanu materiałów trafiają do admina — reaguje on na nie i zamyka alert po uzupełnieniu magazynu.' },
  { icon: <Download className="h-4 w-4" />,      text: 'Usunąć pobranie materiału możesz tylko tego samego dnia, w którym zostało zarejestrowane.' },
  { icon: <RotateCcw className="h-4 w-4" />,     text: 'Sprzęt możesz zwrócić tylko wtedy, gdy sam go wypożyczyłeś. Administrator może zwrócić każde wypożyczenie.' },
]

export default function HelpPage() {
  const t = useTheme()
  return (
    <div className="animate-fade-in space-y-6" style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Nagłówek */}
      <div className="flex items-center gap-3">
        <div
          style={{
            height: 44, width: 44, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(150deg, #3b7ef8, #1a4280)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(39,97,235,0.35)',
          }}
        >
          <BookOpen className="h-5 w-5" style={{ color: '#e0ecfd' }} />
        </div>
        <div>
          <h1 className="page-title">Instrukcja obsługi</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: t.inkDim }}>
            Jak korzystać z systemu Kahma
          </p>
        </div>
      </div>

      {/* Sekcje modułów */}
      <div className="space-y-4">
        {sections.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl overflow-hidden"
            style={{ background: t.surface, boxShadow: t.cardShadow }}
          >
            {/* Nagłówek sekcji */}
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{ borderBottom: `1px solid ${t.border}` }}
            >
              <div
                style={{
                  height: 36, width: 36, borderRadius: 10, flexShrink: 0,
                  background: `${s.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: s.color,
                }}
              >
                {s.icon}
              </div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>{s.title}</h2>
            </div>

            {/* Kroki */}
            <ol className="px-5 py-4 space-y-3">
              {s.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    style={{
                      flexShrink: 0,
                      marginTop: 1,
                      height: 20, width: 20,
                      borderRadius: 6,
                      background: `${s.color}14`,
                      color: s.color,
                      fontWeight: 700,
                      fontSize: 11,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.6, color: t.ink }}>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {/* Ważne wskazówki */}
      <div>
        <p className="section-label mb-3">Ważne wskazówki</p>
        <div className="space-y-2">
          {tips.map((tip, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-2xl px-4 py-3"
              style={{
                background: t.blue.bg,
                boxShadow: t.blue.ring,
              }}
            >
              <span style={{ color: t.inkDim, flexShrink: 0, marginTop: 1 }}>{tip.icon}</span>
              <span style={{ fontSize: 13, lineHeight: 1.6, color: t.ink }}>{tip.text}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
