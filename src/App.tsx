import { useState } from "react";
import "./App.css";

function App() {
  const [text, setText] = useState("");

  return (
    <textarea
      className="editor"
      value={text}
      onChange={(event) => setText(event.target.value)}
      spellCheck={false}
      autoFocus
    />
  );
}

export default App;
