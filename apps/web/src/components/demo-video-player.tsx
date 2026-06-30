import { cn } from '@/lib/utils';
import { Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function DemoVideoPlayer({
  src,
  autoPlay = false,
  className,
  videoClassName,
}: {
  src: string;
  autoPlay?: boolean;
  className?: string;
  videoClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(!autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      playVideo();
    } else {
      video.pause();
    }
  };

  const playVideo = () => {
    void videoRef.current?.play().catch(() => {
      setPaused(true);
    });
  };

  const seekTo = (nextProgress: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = (nextProgress / 100) * duration;
  };

  const toggleMuted = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const changeVolume = (nextVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
  };

  const toggleFullscreen = async () => {
    const root = rootRef.current;
    if (!root) return;
    try {
      if (document.fullscreenElement === root) {
        await document.exitFullscreen();
      } else {
        await root.requestFullscreen();
      }
    } catch {
      setIsFullscreen(document.fullscreenElement === root);
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        'flex flex-col overflow-hidden rounded-xl bg-neutral-950 text-white shadow-sm [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:rounded-none',
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={src}
          autoPlay={autoPlay}
          playsInline
          preload="metadata"
          tabIndex={0}
          aria-label="演示视频，按空格或回车播放和暂停"
          className={cn('aspect-video max-h-full w-full bg-black object-contain', videoClassName)}
          onClick={togglePlay}
          onKeyDown={(event) => {
            if (event.key !== ' ' && event.key !== 'Enter') return;
            event.preventDefault();
            togglePlay();
          }}
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration || 0);
            setCurrentTime(event.currentTarget.currentTime || 0);
            setMuted(event.currentTarget.muted);
            setVolume(event.currentTarget.volume);
          }}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onVolumeChange={(event) => {
            setMuted(event.currentTarget.muted);
            setVolume(event.currentTarget.volume);
          }}
          onEnded={() => setPaused(true)}
        >
          <track kind="captions" label="暂无字幕" src="data:text/vtt,WEBVTT%0A" />
        </video>
      </div>

      <div className="shrink-0 border-t border-white/10 bg-neutral-950 px-4 py-3">
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={progress}
          onChange={(event) => seekTo(Number(event.currentTarget.value))}
          aria-label="播放进度"
          className="mb-3 h-1 w-full accent-white"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={paused ? '播放' : '暂停'}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          >
            {paused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4" />}
          </button>
          <div className="min-w-[76px] font-mono text-[12px] text-white/75">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
          {duration > 0 && currentTime >= duration - 0.2 ? (
            <button
              type="button"
              onClick={() => {
                seekTo(0);
                playVideo();
              }}
              aria-label="重新播放"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMuted}
              aria-label={muted ? '取消静音' : '静音'}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => changeVolume(Number(event.currentTarget.value))}
              aria-label="音量"
              className="hidden h-1 w-20 accent-white sm:block"
            />
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? '退出全屏' : '全屏'}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
