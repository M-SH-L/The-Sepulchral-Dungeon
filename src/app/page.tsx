import Game from '@/components/game/game';
// LevelSelect import removed

export default function Home() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* The Game component will now handle the intro screen overlay */}
      <Game />
    </div>
  );
}