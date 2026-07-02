interface WelcomeScreenProps {
  onStart: () => void;
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <div className="welcome">
      <div className="welcome-intro">
        <h1 className="welcome-title">Ken&apos;s Editor</h1>
        <p className="welcome-lead">一叠自动保存的白纸</p>
      </div>
      <button type="button" className="welcome-start" onClick={onStart}>
        开始
      </button>
      <div className="welcome-details">
        <p>点「开始」后，会在你的「文稿」目录建一个 KensEditor 文件夹，之后写的东西都会自动保存在那里。</p>
        <p>无需联网，所有内容只留在这台 Mac 上。</p>
      </div>
    </div>
  );
}
