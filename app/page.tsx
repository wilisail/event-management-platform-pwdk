"use client";

import { useEffect, useMemo, useState } from "react";
import {
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Heart,
    MapPin,
    Menu,
    Search,
    Sparkles,
    Star,
    Ticket,
    Users,
    X,
} from "lucide-react";

type Event = {
    id: string;
    title: string;
    category: string;
    date: string;
    dateLabel: string;
    location: string;
    price: number | null;
    image: string | null;
    organizer: string;
    availableSeats: number;
    rating?: string;
    featured?: string;
};

type EventsApiResponse = {
    success: boolean;
    data?: Omit<Event, "dateLabel">[];
    message?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4002";

const formatDateLabel = (date: string) =>
    new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
    }).format(new Date(date));


const categories = [
    "Semua",
    "Musik",
    "Food & Beverage",
    "Workshops",
    "Teknologi",
    "Olahraga",
    "Seni & Budaya",
    "Edukasi",
    "Komunitas",
];
const formatPrice = (price: number | null) =>
    price
        ? new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              maximumFractionDigits: 0,
          })
              .format(price)
              .replace("IDR", "Rp")
        : "Gratis";

export default function Page() {
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("Semua");
    const [location, setLocation] = useState("Semua Kota");
    const [menu, setMenu] = useState(false);
    const [liked, setLiked] = useState<string[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        async function loadEvents() {
            try {
                setLoading(true);
                setError(null);
                const response = await fetch(`${API_URL}/api/events`, {
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(`API request failed (${response.status})`);
                }
                const result = (await response.json()) as EventsApiResponse;
                if (!result.success || !Array.isArray(result.data)) {
                    throw new Error(result.message || "Invalid API response");
                }
                setEvents(
                    result.data.map((event) => ({
                        ...event,
                        dateLabel: formatDateLabel(event.date),
                    })),
                );
            } catch (fetchError) {
                if (fetchError instanceof Error && fetchError.name === "AbortError") return;
                setError("Gagal memuat event. Pastikan API dan koneksi database sedang berjalan.");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        void loadEvents();
        return () => controller.abort();
    }, []);

    const filtered = useMemo(
        () =>
            events.filter((event) => {
                const haystack =
                    `${event.title} ${event.category} ${event.location} ${event.organizer}`.toLowerCase();
                return (
                    haystack.includes(query.toLowerCase()) &&
                    (category === "Semua" || event.category === category) &&
                    (location === "Semua Kota" || event.location.includes(location))
                );
            }),
        [events, query, category, location],
    );
    const featured = events.slice(0, 3);

    return (
        <div className="min-h-screen bg-[#fcf9ff] text-[#11103d]">
            <header className="border-b border-[#eee9fb] bg-white/90 backdrop-blur sticky top-0 z-20">
                <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5">
                    <a
                        href="#top"
                        className="flex items-center gap-2 font-black tracking-tight text-[#11103d]"
                    >
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#4f46e5] text-xs text-white">
                            ✦
                        </span>{" "}
                        Temu<span className="text-[#e539a7]">Event</span>
                    </a>
                    <nav
                        className={`${menu ? "flex" : "hidden"} absolute left-0 top-16 w-full flex-col gap-5 border-b bg-white p-5 text-sm md:static md:flex md:w-auto md:flex-row md:border-0 md:bg-transparent md:p-0`}
                    >
                        <a href="#explore">Explore Events</a>
                        <a href="#categories">Categories</a>
                        <a href="#how">How It Works</a>
                        <a className="text-[#5146df]" href="#organizer">
                            For Organizers
                        </a>
                    </nav>
                    <div className="flex items-center gap-3">
                        <button className="hidden text-sm text-[#4f46e5] sm:block">
                            Log in
                        </button>
                        <a
                            href="/organizer/events/new"
                            className="hidden rounded-full bg-[#4f46e5] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-200 sm:block"
                        >
                            + Buat Event
                        </a>
                        <button
                            aria-label="Open menu"
                            onClick={() => setMenu(!menu)}
                            className="rounded-full p-2 md:hidden"
                        >
                            {menu ? <X size={20} /> : <Menu size={20} />}
                        </button>
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-[#ffe6f4] text-xs font-bold">
                            AR
                        </div>
                    </div>
                </div>
            </header>
            <main id="top">
                <section className="hero-bg px-5 pb-14 pt-16 text-center">
                    <div className="mx-auto max-w-[760px]">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold text-[#606078] shadow-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{" "}
                            500+ KOMUNITAS AKTIF BERGABUNG
                        </div>
                        <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                            Temukan Pengalaman Seru
                            <br />
                            <span className="gradient-text">
                                Berikutnya di Kotamu
                            </span>
                        </h1>
                        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#6f6b86]">
                            Jelajahi konser musik intim, workshop kreatif, meet
                            up teknologi, hingga festival kuliner seru bersama
                            komunitas lokal di seluruh Indonesia.
                        </p>
                        <div className="mt-8 rounded-2xl bg-white p-2 text-left shadow-[0_15px_40px_rgba(100,73,190,.14)]">
                            <div className="flex flex-col gap-2 md:flex-row">
                                <label className="flex flex-1 items-center gap-2 rounded-xl bg-[#f6f3fc] px-4 py-3 text-sm text-[#9390a3]">
                                    <Search size={17} />
                                    <input
                                        aria-label="Cari event"
                                        value={query}
                                        onChange={(e) =>
                                            setQuery(e.target.value)
                                        }
                                        className="w-full bg-transparent outline-none placeholder:text-[#aaa7b9]"
                                        placeholder="Cari konser, workshop atau meetup..."
                                    />
                                </label>
                                <select
                                    aria-label="Pilih kota"
                                    value={location}
                                    onChange={(e) =>
                                        setLocation(e.target.value)
                                    }
                                    className="rounded-xl bg-[#f6f3fc] px-4 py-3 text-sm outline-none"
                                >
                                    <option>Semua Kota</option>
                                    <option>Jakarta</option>
                                    <option>Bandung</option>
                                    <option>Bogor</option>
                                    <option>Surabaya</option>
                                    <option>Tangerang Selatan</option>
                                </select>
                                <button
                                    onClick={() =>
                                        document
                                            .getElementById("explore")
                                            ?.scrollIntoView({
                                                behavior: "smooth",
                                            })
                                    }
                                    className="flex items-center justify-center gap-2 rounded-xl bg-[#4e46dc] px-6 py-3 text-sm font-bold text-white"
                                >
                                    <Search size={16} /> Cari Event
                                </button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 px-2 text-[10px] text-[#7e7a91]">
                                <span>POPULER:</span>
                                {[
                                    "Jakarta Coffee Festival",
                                    "Independent Music Night",
                                    "Tech Meetup",
                                ].map((x) => (
                                    <button
                                        key={x}
                                        onClick={() => setQuery(x)}
                                        className="rounded-full bg-[#f5efff] px-2 py-1"
                                    >
                                        {x}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
                <section
                    id="categories"
                    className="mx-auto max-w-[1180px] px-5 py-8"
                >
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-bold">
                            Pilih Kategori Favorit{" "}
                            <span className="ml-1 rounded-full bg-[#eee9ff] px-2 py-0.5 text-[9px] text-[#5b50d9]">
                                Semua
                            </span>
                        </h2>
                        <button
                            onClick={() => {
                                setCategory("Semua");
                                setLocation("Semua Kota");
                                setQuery("");
                            }}
                            className="text-[10px] text-[#6357de]"
                        >
                            ↻ Reset Filter
                        </button>
                    </div>
                    <div className="category-scrollbar flex gap-2 overflow-x-auto pb-1">
                        {categories.map((item, i) => (
                            <button
                                key={item}
                                onClick={() => setCategory(item)}
                                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-semibold ${category === item ? "border-[#4e46dc] bg-[#4e46dc] text-white" : "border-[#ebe7f5] bg-white text-[#59566b]"}`}
                            >
                                {i === 0 ? "☷" : "✦"} &nbsp;{item}
                            </button>
                        ))}
                    </div>
                </section>
                <section className="mx-auto max-w-[1180px] px-5 pb-12">
                    <div className="mb-4 flex items-end justify-between">
                        <div>
                            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#e03c9b]">
                                ✿ Highlight Kurasi
                            </p>
                            <h2 className="text-2xl font-black">
                                Event Pilihan Minggu Ini
                            </h2>
                            <p className="text-xs text-[#858196]">
                                Tiket terlaris dengan atmosfer komunitas paling
                                hidup di kotamu.
                            </p>
                        </div>
                        <div className="hidden gap-2 sm:flex">
                            <button className="rounded-full bg-[#f0ecff] p-2">
                                <ChevronLeft size={14} />
                            </button>
                            <button className="rounded-full bg-[#f0ecff] p-2">
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                    {loading ? (
                        <p className="rounded-xl bg-white p-6 text-center text-sm text-[#858196]">Memuat event...</p>
                    ) : error ? (
                        <p role="alert" className="rounded-xl bg-white p-6 text-center text-sm text-red-600">{error}</p>
                    ) : featured.length ? (
                        <div className="grid gap-5 md:grid-cols-3">
                            {featured.map((event) => (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    featured
                                    liked={liked.includes(event.id)}
                                    onLike={() => setLiked((v) => v.includes(event.id) ? v.filter((x) => x !== event.id) : [...v, event.id])}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="rounded-xl bg-white p-6 text-center text-sm text-[#858196]">Belum ada event mendatang yang dipublikasikan.</p>
                    )}
                </section>
                <section
                    id="explore"
                    className="mx-auto max-w-[1180px] px-5 pb-20"
                >
                    <div className="mb-5 flex flex-col justify-between gap-3 border-b border-[#eeeaf6] pb-4 sm:flex-row sm:items-end">
                        <div>
                            <h2 className="text-2xl font-black">
                                Jelajahi Semua Event Mendatang
                            </h2>
                            <p className="text-xs text-[#858196]">
                                Menampilkan {filtered.length} event di Indonesia
                                · Diurutkan berdasarkan tanggal
                            </p>
                        </div>
                        <select className="rounded-full border border-[#e8e3f2] bg-white px-3 py-2 text-xs">
                            <option>Tanggal: Terdekat</option>
                            <option>Harga: Terendah</option>
                        </select>
                    </div>
                    {loading ? (
                        <p className="rounded-xl bg-white p-6 text-center text-sm text-[#858196]">Memuat event...</p>
                    ) : error ? (
                        <p role="alert" className="rounded-xl bg-white p-6 text-center text-sm text-red-600">{error}</p>
                    ) : filtered.length ? (
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {filtered.map((event) => (
                                <EventCard
                                    key={`${event.id}-${event.title}`}
                                    event={event}
                                    liked={liked.includes(event.id)}
                                    onLike={() =>
                                        setLiked((v) =>
                                            v.includes(event.id)
                                                ? v.filter(
                                                      (x) => x !== event.id,
                                                  )
                                                : [...v, event.id],
                                        )
                                    }
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-3xl bg-white py-20 text-center shadow-sm">
                            <Search className="mx-auto mb-3 text-[#b7b0da]" />
                            <h3 className="font-bold">Event belum ditemukan</h3>
                            <p className="mt-1 text-sm text-[#858196]">
                                Coba kata kunci atau kategori lainnya.
                            </p>
                        </div>
                    )}
                </section>
                <section
                    id="organizer"
                    className="mx-5 mb-20 overflow-hidden rounded-2xl bg-gradient-to-br from-[#4d4ce8] via-[#5554e8] to-[#c52892] text-white shadow-xl shadow-indigo-200"
                >
                    <div className="mx-auto flex max-w-[1180px] flex-col items-start gap-8 px-7 py-9 sm:px-12 md:flex-row md:items-center md:justify-between">
                        <div className="max-w-lg">
                            <span className="rounded-full bg-white/15 px-3 py-1 text-[9px] font-bold">
                                ✦ PELUANG KREATOR & KOMUNITAS
                            </span>
                            <h2 className="mt-4 text-3xl font-black leading-tight">
                                Punya Event Seru yang Ingin Dibagikan?
                            </h2>
                            <p className="mt-3 text-sm text-white/80">
                                Publikasikan workshop, gig musik, atau seminar
                                komunitasmu dalam 3 menit. Dapatkan sistem tiket
                                otomatis dan pencairan instan.
                            </p>
                            <a
                                href="/organizer/events/new"
                                className="mt-5 inline-block rounded-full bg-white px-5 py-3 text-xs font-bold text-[#4d49d8]"
                            >
                                Mulai Buat Event Sekarang&nbsp; →
                            </a>
                        </div>
                        <div className="hidden w-72 rotate-2 rounded-2xl bg-white/15 p-4 backdrop-blur md:block">
                            <div className="flex items-center gap-3">
                                <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-xs font-bold text-[#4d49d8]">
                                    TE
                                </div>
                                <div className="text-[10px] font-bold">
                                    Dashboard Penyelenggara
                                    <p className="font-normal text-white/60">
                                        Status Penjualan: Final
                                    </p>
                                </div>
                                <span className="ml-auto rounded-full bg-emerald-300 px-2 py-1 text-[8px] text-emerald-900">
                                    Live
                                </span>
                            </div>
                            <div className="mt-6 text-[9px] text-white/70">
                                Tiket Terjual (Presale 1)
                                <strong className="float-right text-white">
                                    285 / 500
                                </strong>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-white/20">
                                <div className="h-2 w-3/5 rounded-full bg-white" />
                            </div>
                            <div className="mt-4 flex gap-2">
                                <div className="flex-1 rounded-lg bg-white/10 p-2 text-[9px]">
                                    Total Pendapatan
                                    <strong className="block text-sm">
                                        Rp 42.7M
                                    </strong>
                                </div>
                                <div className="flex-1 rounded-lg bg-white/10 p-2 text-[9px]">
                                    Kehadiran
                                    <strong className="block text-sm">
                                        98.4%
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <footer
                id="how"
                className="border-t border-[#eee9fb] bg-[#f7f3ff] px-5 py-10 text-xs text-[#77738b]"
            >
                <div className="mx-auto grid max-w-[1180px] gap-8 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                        <div className="font-black text-[#11103d]">
                            ✦ Temu<span className="text-[#e539a7]">Event</span>
                        </div>
                        <p className="mt-3 max-w-xs leading-5">
                            Platform kurasi & tiket komunitas terfavorit
                            Indonesia. Menyatukan penggiat kreatif, penikmat
                            musik, kuliner, dan komunitas lokal.
                        </p>
                    </div>
                    <div>
                        <p className="mb-3 font-bold text-[#35314c]">
                            PENCARI EVENT
                        </p>
                        <p>Jelajah Musik</p>
                        <p className="mt-2">Workshop & Seminar</p>
                        <p className="mt-2">Kuliner Nusantara</p>
                    </div>
                    <div>
                        <p className="mb-3 font-bold text-[#35314c]">
                            PENYELENGGARA
                        </p>
                        <p>Buat Event</p>
                        <p className="mt-2">Manajemen Tiket</p>
                        <p className="mt-2">Skema Biaya</p>
                    </div>
                </div>
                <div className="mx-auto mt-8 max-w-[1180px] border-t border-[#e9e2f5] pt-5 text-[10px]">
                    © 2025 TemuEvent Indonesia. Seluruh hak cipta dilindungi
                    undang-undang.
                </div>
            </footer>
        </div>
    );
}

function EventCard({
    event,
    featured = false,
    liked,
    onLike,
}: {
    event: Event;
    featured?: boolean;
    liked: boolean;
    onLike: () => void;
}) {
    return (
        <article
            className={`group overflow-hidden rounded-2xl border border-[#ebe7f5] bg-white shadow-[0_5px_18px_rgba(64,45,120,.06)] transition hover:-translate-y-1 hover:shadow-lg ${featured ? "" : ""}`}
        >
            <div className="relative aspect-[1.58] overflow-hidden">
                {event.image ? (
                    <img
                        src={event.image}
                        alt={event.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="grid h-full w-full place-items-center bg-[#eeeaff] text-sm font-semibold text-[#5148d7]">TemuEvent</div>
                )}
                <div className="absolute inset-x-0 top-0 flex justify-between p-2">
                    <span className="rounded-md bg-white px-2 py-1 text-[9px] font-bold text-[#26213f]">
                        {event.featured || event.category}
                    </span>
                    <button
                        aria-label="Simpan event"
                        onClick={onLike}
                        className={`rounded-full p-1.5 ${liked ? "bg-[#ffe3f2] text-[#e23696]" : "bg-white/90 text-[#77738b]"}`}
                    >
                        <Heart
                            size={13}
                            fill={liked ? "currentColor" : "none"}
                        />
                    </button>
                </div>
            </div>
            <div className="p-3.5">
                <div className="flex items-center justify-between text-[9px] text-[#858196]">
                    <span className="font-semibold text-[#4e46dc]">
                        {event.category}
                    </span>
                    {event.rating && (
                        <span className="flex items-center gap-1">
                            <Star
                                size={10}
                                fill="#f59e0b"
                                className="text-amber-500"
                            />{" "}
                            {event.rating}
                        </span>
                    )}
                </div>
                <h3 className="mt-2 min-h-[40px] text-sm font-bold leading-5 text-[#211d3b]">
                    {event.title}
                </h3>
                <p className="mt-2 flex items-center gap-1 text-[10px] text-[#858196]">
                    <MapPin size={11} /> {event.location}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-[#f1eef7] pt-3">
                    <div>
                        <p className="text-[9px] uppercase text-[#a29eb0]">
                            {featured ? "Mulai dari" : event.dateLabel}
                        </p>
                        <p
                            className={`font-bold ${event.price ? "text-[#4e46dc]" : "text-emerald-600"}`}
                        >
                            {formatPrice(event.price)}
                        </p>
                    </div>
                    <a
                        href={`/events/${event.id}`}
                        className="rounded-lg bg-[#eeeaff] px-3 py-1.5 text-[10px] font-bold text-[#5148d7]"
                    >
                        Detail
                    </a>
                </div>
            </div>
        </article>
    );
}
