// /app/page.tsx
import GuestHeroCompass from "@/components/home/GuestHeroCompass";
import HomeFooter from "@/components/home/HomeFooter";
import HomeHeader from "@/components/home/HomeHeader";
import HomePageSections from "@/components/home/HomePageSections";

export default function Page() {
  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        background: "#ffffff",
        color: "#0f172a",
      }}
    >
      <HomeHeader />
      <main>
        <section aria-label="HOPY hero">
          <GuestHeroCompass />
        </section>
        <HomePageSections />
        <HomeFooter />
      </main>
    </div>
  );
}