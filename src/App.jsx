import { useAsciiText, deltaCorpsPriest1 as font } from "react-ascii-text";

function App() {
  const asciiTextRef = useAsciiText({
    animationCharacters: "▒░█",
    animationCharacterSpacing: 1,
    animationDelay: 2000,
    animationDirection: "up",
    animationInterval: 100,
    animationLoop: true,
    animationSpeed: 30,
    font: font,
    text: ["NOTHING", "TO", "SEE", "HERE"],
  });

  return (
    <div className=" min-h-screen bg-slate-900 text-slate-600 text-[8px] md:text-xl lg:text-2xl flex justify-center items-center">
      <pre ref={asciiTextRef}></pre>
    </div>
  );
}

export default App;
