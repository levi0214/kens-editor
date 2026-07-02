interface WelcomeScreenProps {
  onStart: () => void;
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <div className="welcome">
      <div className="welcome-intro">
        <h1 className="welcome-title">Ken&apos;s Editor</h1>
        <p className="welcome-lead">一叠会自动保存的白纸</p>
      </div>
      <button type="button" className="welcome-start" onClick={onStart}>
        开始
      </button>
      <div className="welcome-details">
        <p>点击「开始」后，会在「文稿」里创建「KensEditor」文件夹。</p>
        <p>你写下的内容会自动保存在那里。</p>
        <p>无需联网，只保存在这台 Mac 上。</p>
      </div>
    </div>
  );
}
