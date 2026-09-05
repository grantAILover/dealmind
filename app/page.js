import WaitlistForm from '@/components/WaitlistForm';

// Value points — kodėl Detalo, ne Facebook grupės.
const POINTS = [
  {
    title: 'Pirkėjo apsauga',
    body: 'Pinigai saugomi, kol gauni dalį. Ne kaip FB — jokio „sumokėjai ir dingo".',
  },
  {
    title: 'Kaina + pasiūlymai',
    body: 'Matai kainą iškart. O nori pigiau — pasiūlyk savo kainą vienu mygtuku, pardavėjas priima arba atmeta. Aiškios derybos, be „kokia paskutinė?" chaoso.',
  },
  {
    title: 'Mopedų bendruomenei',
    body: 'Nuo senų Karpaty ir Riga iki modernių skuterių — viskas vienoje vietoje.',
  },
  {
    title: 'Aiškūs skelbimai',
    body: 'Nuotraukos, būklė, markė, modelis, vieta. Susirandi tinkamą dalį per minutę.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6">
        {/* NAV */}
        <nav className="flex items-center justify-between h-16 border-b border-white/8">
          <div className="flex items-center gap-2.5 font-semibold tracking-tight text-txt">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M8 5.3h8l4 6.9-4 6.9H8l-4-6.9 4-6.9z" stroke="#7fd1e6" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="12" cy="12.2" r="3.1" stroke="#7fd1e6" strokeWidth="1.6" />
            </svg>
            Detalo
          </div>
          <span className="text-xs text-frost border border-frost/40 rounded-full px-3 py-1">Netrukus</span>
        </nav>

        {/* HERO */}
        <section className="pt-20 pb-4 max-w-2xl">
          <h1 className="text-5xl font-bold tracking-tight leading-[1.05] text-txt">
            Mopedų dalių turgus.
            <br />
            <span className="text-frost">Saugus.</span>
          </h1>
          <p className="text-muted text-lg mt-5 leading-relaxed">
            Pirk ir parduok mopedų dalis be Facebook grupių chaoso ir sukčių —
            su pirkėjo apsauga, tikromis kainomis ir aiškiais skelbimais.
          </p>

          <div className="mt-8">
            <p className="text-txt font-semibold mb-3">Užsiregistruok — pranešime, kai startuosim:</p>
            <WaitlistForm />
          </div>
        </section>

        {/* VALUE POINTS */}
        <section className="grid sm:grid-cols-2 gap-4 mt-16 pb-20">
          {POINTS.map((p) => (
            <div key={p.title} className="bg-panel border border-white/8 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-frost" />
                <h3 className="text-txt font-semibold">{p.title}</h3>
              </div>
              <p className="text-muted text-sm leading-relaxed">{p.body}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
