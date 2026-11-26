import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Heart,
  MessageSquare,
  Share2,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { sanitizeIdSegment } from '../lib/builtinCatalog';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { ActiveVideoSelection, CommentItem } from '../types/media';
import { MediaThumbnail } from './MediaThumbnail';

interface VideoPlayerModalProps {
  selection: ActiveVideoSelection;
  user: User | null;
  onRequireSignIn: () => void;
  onClose: () => void;
  subscribedChannelIds: Set<string>;
  likedYtIds: Set<string>;
  onToast: (msg: string) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  selection,
  user,
  onRequireSignIn,
  onClose,
  subscribedChannelIds,
  likedYtIds,
  onToast,
}) => {
  const isYt = selection.kind === 'youtube';
  const targetId = isYt ? `yt_${selection.video.videoId}` : selection.media.id;
  const targetType = isYt ? 'youtube' : 'media';

  const title = isYt ? selection.video.title : selection.media.title;
  const channelName = isYt
    ? selection.video.channelTitle
    : selection.media.artistOrChannel;
  const channelId = isYt
    ? selection.video.channelId
    : selection.media.authorId;
  const channelPhoto = isYt ? '' : selection.media.authorPhoto || '';
  const durationLabel = isYt
    ? selection.video.durationLabel
    : selection.media.durationLabel;
  const categoryLabel = isYt
    ? selection.categoryHint || 'YouTube'
    : selection.media.category;

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isLikedMedia, setIsLikedMedia] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const [liveViews, setLiveViews] = useState(
    isYt ? selection.video.viewsCount : selection.media.viewsCount
  );
  const [liveLikes, setLiveLikes] = useState(
    isYt ? 0 : selection.media.likesCount
  );

  const isSubscribed = subscribedChannelIds.has(channelId);
  const isLiked = isYt ? likedYtIds.has(selection.video.videoId) : isLikedMedia;

  // Escape key close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Increment view count once for community uploaded media when signed in
  useEffect(() => {
    if (isYt || !user) return;
    const mediaRef = doc(db, 'media', selection.media.id);
    updateDoc(mediaRef, {
      viewsCount: increment(1),
      updatedAt: serverTimestamp(),
    }).catch(() => {
      // Ignore view increment error if offline or unverified
    });
  }, [isYt, selection, user]);

  // Listen to live media counters if community upload
  useEffect(() => {
    if (isYt) return;
    const mediaRef = doc(db, 'media', selection.media.id);
    const unsub = onSnapshot(
      mediaRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setLiveViews(Number(data.viewsCount || 0));
          setLiveLikes(Number(data.likesCount || 0));
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `media/${selection.media.id}`)
    );
    return unsub;
  }, [isYt, selection]);

  // Listen to whether current user liked this uploaded media
  useEffect(() => {
    if (isYt || !user) {
      setIsLikedMedia(false);
      return;
    }
    const likePath = `media/${selection.media.id}/likes/${user.uid}`;
    const unsub = onSnapshot(
      doc(db, likePath),
      (snap) => {
        setIsLikedMedia(snap.exists());
      },
      (err) => handleFirestoreError(err, OperationType.GET, likePath)
    );
    return unsub;
  }, [isYt, selection, user]);

  // Real-time comments listener
  useEffect(() => {
    const q = query(
      collection(db, 'comments'),
      where('targetId', '==', targetId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: CommentItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CommentItem, 'id'>),
        }));
        setComments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'comments')
    );
    return unsub;
  }, [targetId]);

  const handleToggleLike = async () => {
    if (!user) {
      onRequireSignIn();
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      if (isYt) {
        const likeId = `${user.uid}_${sanitizeIdSegment(selection.video.videoId)}`;
        const ref = doc(db, 'yt_likes', likeId);
        if (isLiked) {
          await deleteDoc(ref);
          onToast('পছন্দের তালিকা থেকে সরানো হয়েছে');
        } else {
          await setDoc(ref, {
            id: likeId,
            userId: user.uid,
            videoId: selection.video.videoId,
            title: selection.video.title.slice(0, 200),
            thumbnailUrl: selection.video.thumbnailUrl.slice(0, 600),
            channelTitle: selection.video.channelTitle.slice(0, 100),
            category: categoryLabel.slice(0, 60),
            createdAt: serverTimestamp(),
          });
          onToast('ভিডিওটি লাইক করা হয়েছে');
        }
      } else {
        const mediaRef = doc(db, 'media', selection.media.id);
        const likeRef = doc(db, 'media', selection.media.id, 'likes', user.uid);
        const batch = writeBatch(db);
        if (isLiked) {
          batch.delete(likeRef);
          batch.update(mediaRef, {
            likesCount: increment(-1),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(likeRef, {
            userId: user.uid,
            mediaId: selection.media.id,
            createdAt: serverTimestamp(),
          });
          batch.update(mediaRef, {
            likesCount: increment(1),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, isYt ? 'yt_likes' : `media/${targetId}`);
    } finally {
      setLikeBusy(false);
    }
  };

  const handleToggleSubscribe = async () => {
    if (!user) {
      onRequireSignIn();
      return;
    }
    if (subBusy) return;
    setSubBusy(true);
    const subId = `${user.uid}_${sanitizeIdSegment(channelId)}`;
    const subRef = doc(db, 'subscriptions', subId);
    try {
      if (isSubscribed) {
        await deleteDoc(subRef);
        onToast(`${channelName} আনসাবস্ক্রাইব করা হয়েছে`);
      } else {
        await setDoc(subRef, {
          id: subId,
          userId: user.uid,
          channelId: channelId.slice(0, 128),
          channelName: channelName.slice(0, 100),
          channelPhoto: channelPhoto.slice(0, 500),
          createdAt: serverTimestamp(),
        });
        onToast(`${channelName} সাবস্ক্রাইব করা হয়েছে`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `subscriptions/${subId}`);
    } finally {
      setSubBusy(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireSignIn();
      return;
    }
    const clean = commentText.trim().slice(0, 800);
    if (!clean || submittingComment) return;
    setSubmittingComment(true);
    const commentId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const commentRef = doc(db, 'comments', commentId);
      const payload = {
        id: commentId,
        targetId,
        targetType,
        authorId: user.uid,
        authorName: (user.displayName || 'ব্যবহারকারী').slice(0, 100),
        authorPhoto: (user.photoURL || '').slice(0, 500),
        text: clean,
        createdAt: serverTimestamp(),
      };
      if (isYt) {
        await setDoc(commentRef, payload);
      } else {
        const batch = writeBatch(db);
        batch.set(commentRef, payload);
        batch.update(doc(db, 'media', selection.media.id), {
          commentsCount: increment(1),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      }
      setCommentText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `comments/${commentId}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'comments', commentId));
      onToast('মন্তব্য মুছে ফেলা হয়েছে');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `comments/${commentId}`);
    }
  };

  const handleShare = async () => {
    const shareUrl = isYt
      ? `https://www.youtube.com/watch?v=${selection.video.videoId}`
      : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        onToast('লিঙ্ক কপি করা হয়েছে');
      }
    } catch {
      onToast('শেয়ার সম্পন্ন হয়েছে');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-6xl rounded-2xl border border-slate-800 bg-[#0F1117] overflow-hidden shadow-2xl my-auto">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800/90">
          <div className="flex items-center gap-2 text-xs text-slate-400 min-w-0">
            <span className="text-rose-400 font-medium whitespace-nowrap">
              {isYt ? 'YouTube স্ট্রিম' : 'কমিউনিটি আপলোড'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{categoryLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums">{durationLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left: Cinema Video Viewport + Details */}
          <div className="lg:col-span-8 border-b lg:border-b-0 lg:border-r border-slate-800/80">
            <div className="aspect-video bg-black w-full">
              {isYt ? (
                <iframe
                  title={title}
                  src={`https://www.youtube.com/embed/${encodeURIComponent(
                    selection.video.videoId
                  )}?autoplay=1&rel=0`}
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={selection.media.mediaUrl}
                  poster={selection.media.thumbnailUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
              )}
            </div>

            <div className="p-5 space-y-4">
              <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
                {title}
              </h2>

              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-700 shrink-0">
                    <MediaThumbnail
                      src={channelPhoto}
                      alt={channelName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{channelName}</p>
                    <p className="text-xs text-slate-400 font-mono-nums">
                      {isYt
                        ? `${selection.video.viewsLabel} · ${selection.video.publishedText}`
                        : `${liveViews.toLocaleString()} ভিউ`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={subBusy}
                    onClick={handleToggleSubscribe}
                    className={`ml-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      isSubscribed
                        ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                        : 'bg-rose-600 text-white hover:bg-rose-500'
                    }`}
                  >
                    {isSubscribed ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        সাবস্ক্রাইবড
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        সাবস্ক্রাইব
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={likeBusy}
                    onClick={handleToggleLike}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      isLiked
                        ? 'border-rose-500/60 bg-rose-500/15 text-rose-300'
                        : 'border-slate-800 bg-[#151821] text-slate-200 hover:bg-[#1C202C]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                    <span>{isLiked ? 'লাইকড' : 'লাইক'}</span>
                    {!isYt && <span className="font-mono-nums">({liveLikes})</span>}
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-800 bg-[#151821] text-slate-200 text-xs font-semibold hover:bg-[#1C202C] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Share2 className="w-4 h-4" />
                    শেয়ার
                  </button>
                </div>
              </div>

              {!isYt && selection.media.description && (
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {selection.media.description}
                </p>
              )}
            </div>
          </div>

          {/* Right: Live Social Comments Panel */}
          <div className="lg:col-span-4 flex flex-col max-h-[540px] lg:max-h-[680px]">
            <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <MessageSquare className="w-4 h-4 text-rose-400" />
                <span>মন্তব্য</span>
                <span className="text-xs text-slate-400 font-mono-nums">({comments.length})</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  এখনও কোনো মন্তব্য নেই। প্রথম মন্তব্য করুন!
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-700 shrink-0">
                      <MediaThumbnail
                        src={c.authorPhoto}
                        alt={c.authorName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {c.authorName}
                        </span>
                        {user?.uid === c.authorId && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            aria-label="Delete comment"
                            className="text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed break-words">
                        {c.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handlePostComment}
              className="p-4 border-t border-slate-800/80 bg-[#0C0E13] space-y-2"
            >
              <textarea
                rows={2}
                value={commentText}
                maxLength={800}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={
                  user
                    ? 'আপনার মন্তব্য লিখুন...'
                    : 'মন্তব্য করতে Google অ্যাকাউন্ট দিয়ে সাইন ইন করুন'
                }
                className="w-full rounded-lg border border-slate-800 bg-[#141720] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500 resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingComment || (Boolean(user) && !commentText.trim())}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-colors disabled:opacity-50"
                >
                  {user ? (submittingComment ? 'পোস্ট হচ্ছে...' : 'মন্তব্য পোস্ট করুন') : 'সাইন ইন করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
