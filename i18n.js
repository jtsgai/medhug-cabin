/** 语言包：默认中文，可切 English — 整页语言纯净不混用 */
export const dict = {
  zh: {
    status_ready: "",
    status_camera: "",
    status_live: "试穿中",
    status_connecting: "连接中",
    status_applying: "换装中",
    status_ending: "结束中",
    featured: "主推",
    explore: "选衣",
    shortlist: "备选",
    change: "换衣",
    end: "结束",
    try_on: "试穿",
    back: "返回",
    add_shortlist: "加入备选",
    in_shortlist: "已在备选",
    session_title: "本次试穿",
    session_thanks: "感谢体验",
    session_shortlist: "你的备选 · 可再试一次",
    session_hint: "画面将保留片刻",
    done: "完成",
    end_session: "结束试穿",
    toast_expand: "请先点「换衣」",
    toast_no_session: "当前没有进行中的试穿",
    toast_added: "已加入备选",
    placeholder: "",
    retry_from_shortlist: "再试一次",
    lang: "EN",
    attract_hint: "轻触屏幕开始体验",
  },
  en: {
    status_ready: "",
    status_camera: "",
    status_live: "Live",
    status_connecting: "Connecting",
    status_applying: "Applying",
    status_ending: "Ending",
    featured: "Featured",
    explore: "Explore",
    shortlist: "Saved",
    change: "Change",
    end: "End",
    try_on: "Try on",
    back: "Back",
    add_shortlist: "Save",
    in_shortlist: "Saved",
    session_title: "Your session",
    session_thanks: "Thank you",
    session_shortlist: "Shortlist · try again",
    session_hint: "Image will hold briefly",
    done: "Done",
    end_session: "End session",
    toast_expand: "Tap Change first",
    toast_no_session: "No active try-on",
    toast_added: "Saved to shortlist",
    placeholder: "",
    retry_from_shortlist: "Try again",
    lang: "中文",
    attract_hint: "Tap to start",
  },
};

let lang = localStorage.getItem("jt_lang") || "zh";

export function getLang() {
  return lang;
}

export function setLang(l) {
  lang = l === "en" ? "en" : "zh";
  localStorage.setItem("jt_lang", lang);
}

export function t(key) {
  return (dict[lang] && dict[lang][key]) || dict.zh[key] || key;
}
