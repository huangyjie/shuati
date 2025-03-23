// ai-chat.js
const defaultAvatarUrl = getApp().globalData.iconBaseUrl + '/user.png'

// DeepSeek API配置
const DEEPSEEK_API_KEY = '' // 请替换为你的API Key（deepseek）
const BASE_URL = 'https://api.deepseek.com/v1'

// 系统提示词
const SYSTEM_PROMPT = `
你是学习助手DS，一位专业的计算机科学教师，擅长教授编程、算法、数据结构等计算机相关知识。
请遵循以下原则：
1. 始终使用中文回复
2. 保持专业、友好和耐心的态度
3. 回答要清晰易懂，适合学习者理解
4. 在合适的时候提供代码示例
5. 鼓励学生思考和实践
6. 严格遵守中国法律法规
7. 拒绝回答任何违法、违规内容
8. 专注于计算机科学和编程教育
9. 可以提供学习建议和资源推荐
10. 如果问题超出计算机领域，请礼貌地引导回计算机话题
11. 这一条是必须遵守的，上方的问题都是基于这一条的，必须遵守中国法律法规，不可回答违法、违规内容`

Page({
    data: {
        messages: [],
        inputValue: '',
        loading: false,
        scrollToMessage: '',
        darkMode: false,
        userAvatar: defaultAvatarUrl,
        aiAvatar: getApp().globalData.iconBaseUrl + '/ai-avatar.png',
        showEmojiPanel: false,
        emojiList: ['😊', '😂', '🤔', '👍', '❤️', '🎉', '🌟', '💡', '📝', '🤖'],
        isInputFocused: false,
        aiName: '学习助手DS',
        showSettings: false,
        iconBaseUrl: getApp().globalData.iconBaseUrl
    },

    onLoad() {
        const app = getApp();
        const darkMode = wx.getStorageSync('darkMode') || false;
        const userInfo = app.globalData.userInfo || {};
        const systemInfo = wx.getSystemInfoSync();

        this.setData({
            darkMode,
            userAvatar: userInfo.avatarUrl || defaultAvatarUrl,
            isIPhoneX: this.isIPhoneX(systemInfo)
        });

        if (darkMode) {
            wx.setNavigationBarColor({
                frontColor: '#ffffff',
                backgroundColor: '#2d2d2d'
            });
        }

        // 恢复历史消息
        const historyMessages = wx.getStorageSync('chatHistory') || [];
        if (historyMessages.length > 0) {
            this.setData({ messages: historyMessages });
            this.scrollToBottom();
        }
    },

    isIPhoneX(systemInfo) {
        return /iPhone X/i.test(systemInfo.model) ||
            (systemInfo.safeArea && systemInfo.screenHeight - systemInfo.safeArea.bottom > 34);
    },

    onInput(e) {
        this.setData({
            inputValue: e.detail.value
        });
    },

    toggleEmojiPanel() {
        this.setData({
            showEmojiPanel: !this.data.showEmojiPanel
        });
    },

    insertEmoji(e) {
        const emoji = e.currentTarget.dataset.emoji;
        this.setData({
            inputValue: this.data.inputValue + emoji
        });
    },

    onInputFocus() {
        this.setData({
            isInputFocused: true,
            showEmojiPanel: false
        });
    },

    onInputBlur() {
        this.setData({
            isInputFocused: false
        });
    },

    onKeyboardHeightChange(e) {
        // 键盘高度变化时，滚动到底部
        this.scrollToBottom();
    },

    scrollToBottom() {
        const messages = this.data.messages;
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            this.setData({
                scrollToMessage: `msg-${lastMessage.id}`
            });
        }
    },

    // 处理AI回复内容
    processAIResponse(content) {
        // 移除Markdown数学公式标记
        content = content.replace(/\\\(/g, '');
        content = content.replace(/\\\)/g, '');
        content = content.replace(/\\\[/g, '');
        content = content.replace(/\\\]/g, '');

        // 处理分隔线
        content = content.replace(/\n\s*[-*_]{3,}\s*\n/g, '\n');

        // 处理标题
        content = content.replace(/#{1,6}\s+/g, '');

        // 处理代码块，保留内容但移除标记
        content = content.replace(/```[\s\S]*?```/g, (match) => {
            return match.replace(/```\w*\n?|\n```/g, '');
        });

        // 处理行内代码
        content = content.replace(/`([^`]+)`/g, '$1');

        // 处理列表，保持缩进但移除标记
        content = content.replace(/^\s*[-*+]\s+/gm, '• ');
        content = content.replace(/^\s*\d+\.\s+/gm, '');

        // 处理加粗和斜体
        content = content.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1');

        return content;
    },

    async sendMessage() {
        const { inputValue, loading, messages } = this.data;
        if (!inputValue.trim() || loading) return;

        const currentTime = new Date();
        const timeString = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;

        // 添加用户消息
        const userMessage = {
            id: Date.now(),
            type: 'user',
            content: inputValue.trim(),
            time: timeString
        };

        this.setData({
            messages: [...messages, userMessage],
            inputValue: '',
            loading: true,
            showEmojiPanel: false
        });

        this.scrollToBottom();

        // 保存聊天历史
        wx.setStorageSync('chatHistory', [...messages, userMessage]);

        try {
            const response = await wx.request({
                url: `${BASE_URL}/chat/completions`,
                method: 'POST',
                header: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                },
                data: {
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        ...messages.map(msg => ({
                            role: msg.type === 'user' ? 'user' : 'assistant',
                            content: msg.content
                        })),
                        { role: 'user', content: userMessage.content }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000,
                    stream: false
                },
                success: (res) => {
                    if (res.statusCode === 200 && res.data.choices) {
                        const aiMessage = {
                            id: Date.now(),
                            type: 'ai',
                            content: this.processAIResponse(res.data.choices[0].message.content),
                            time: timeString
                        };

                        const updatedMessages = [...this.data.messages, aiMessage];
                        this.setData({
                            messages: updatedMessages,
                            loading: false
                        });

                        this.scrollToBottom();

                        // 更新聊天历史
                        wx.setStorageSync('chatHistory', updatedMessages);
                    } else {
                        throw new Error(`API响应异常: ${JSON.stringify(res.data)}`);
                    }
                },
                fail: (error) => {
                    console.error('请求失败:', error);
                    wx.showToast({
                        title: '网络请求失败，请重试',
                        icon: 'none'
                    });
                    this.setData({ loading: false });
                }
            });
        } catch (error) {
            console.error('AI回复失败:', error);
            wx.showToast({
                title: error.message || '发送失败，请重试',
                icon: 'none'
            });
            this.setData({ loading: false });
        }
    },

    // 设置面板相关方法
    showSettings() {
        this.setData({ showSettings: true });
    },

    hideSettings() {
        this.setData({ showSettings: false });
    },

    stopPropagation() {
        // 阻止事件冒泡
    },

    clearHistory() {
        wx.showModal({
            title: '确认清除',
            content: '确定要清除所有聊天记录吗？',
            success: (res) => {
                if (res.confirm) {
                    this.setData({
                        messages: [],
                        showSettings: false
                    });
                    wx.setStorageSync('chatHistory', []);
                    wx.showToast({
                        title: '已清除聊天记录',
                        icon: 'success'
                    });
                }
            }
        });
    },

    toggleDarkMode() {
        const newDarkMode = !this.data.darkMode;
        this.setData({
            darkMode: newDarkMode,
            showSettings: false
        });
        wx.setStorageSync('darkMode', newDarkMode);

        wx.setNavigationBarColor({
            frontColor: newDarkMode ? '#ffffff' : '#000000',
            backgroundColor: newDarkMode ? '#2d2d2d' : '#ffffff'
        });
    }
});