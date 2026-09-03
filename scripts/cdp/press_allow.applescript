-- press_allow.applescript
-- 作用：在 macOS「辅助功能」权限下，点掉 Google Chrome「要允许远程调试吗？」原生弹窗里的「允许」。
--
-- 【性能关键 · 血泪教训】
--   绝不能递归遍历整个 Chrome 窗口的 AX 树：网页内容区(AXWebArea)有成千上万节点，每个节点都是一次
--   跨进程 AppleEvent 往返，整树遍历在系统繁忙时可达 9 秒以上，会被调用方超时杀掉，表现为
--   「授权窗永远点不中、时好时坏」。而授权弹窗只是挂在 window 上的一个模态 sheet，内部只有寥寥几个按钮。
--   因此本脚本：入口只取 sheets of windows；优先直接取 sheet 的 buttons；兜底也只在 sheet 内部有限深度
--   递归，且遇到 AXWebArea 立即跳过、递归深度封顶。正常耗时稳定在毫秒级。
--
-- 其它已验证事实：
--   - 合成坐标点击只会关窗、不会真正授权；必须对按钮元素 perform action "AXPress"（元素级动作，
--     与屏幕坐标 / 多显示器 / Retina 完全无关，多屏下同样可靠）；
--   - 按钮可见文字在 AXDescription（依次为「在'设置'中关闭 / 取消 / 允许」），AXTitle 为空；
--   - 点中后 sheet 立即关闭，因此「点中即停」，且全程容错：无弹窗 / 进程未就绪 / 元素中途失效，
--     都安静返回 pressed=false 且退出码为 0，可被高频安全重复调用。
--
-- 前置：运行它的宿主需在「系统设置 → 隐私与安全性 → 辅助功能」中授权。

global gPressed
set gPressed to false

-- 在「很小的一棵子树」（授权 sheet）内找「允许」按钮并 AXPress；绝不进入网页区
on findAllow(el, depth)
	global gPressed
	if gPressed then return
	tell application "System Events"
		try
			set r to role of el
		on error
			return
		end try
		if r is "AXWebArea" then return -- 网页内容区：节点海量，是慢的根源，绝不进入
		if depth > 12 then return
		if r is "AXButton" then
			set d to ""
			try
				set d to (description of el) as string
			end try
			if d contains "允许" then
				try
					perform action "AXPress" of el
					set gPressed to true
				end try
				return
			end if
		end if
		try
			repeat with c in UI elements of el
				my findAllow(c, depth + 1)
				if gPressed then exit repeat
			end repeat
		end try
	end tell
end findAllow

set report to ""
tell application "System Events"
	if not (exists process "Google Chrome") then
		return "pressed=false" & linefeed
	end if
	try
		tell process "Google Chrome"
			repeat with w in windows
				try
					repeat with sh in sheets of w
						-- 最快路径：按钮直接挂在 sheet 上
						try
							repeat with b in buttons of sh
								set dd to ""
								try
									set dd to (description of b) as string
								end try
								set report to report & "BTN-D[" & dd & "] "
								if dd contains "允许" then
									perform action "AXPress" of b
									set gPressed to true
								end if
							end repeat
						end try
						-- 兜底：按钮若被 group/分裂层包裹，只在这棵很小的 sheet 子树内有限递归
						if not gPressed then my findAllow(sh, 0)
					end repeat
				end try
			end repeat
		end tell
	end try
end tell
return "pressed=" & (gPressed as string) & linefeed & report
