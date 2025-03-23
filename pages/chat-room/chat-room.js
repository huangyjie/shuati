// 添加段位判断函数
const getTierInfo = (points) => {
  if (points >= 5000) {
    return {
      tier: '至尊',
      tierClass: 'tier-supreme',
      color: '#8a2be2'
    };
  } else if (points >= 3600) {
    return {
      tier: '王者',
      tierClass: 'tier-king',
      color: '#ff4d4f'
    };
  } else if (points >= 3000) {
    return {
      tier: '大师',
      tierClass: 'tier-master',
      color: '#722ed1'
    };
  } else if (points >= 2400) {
    return {
      tier: '钻石',
      tierClass: 'tier-diamond',
      color: '#1890ff'
    };
  } else if (points >= 1800) {
    return {
      tier: '铂金',
      tierClass: 'tier-platinum',
      color: '#13c2c2'
    };
  } else if (points >= 1200) {
    return {
      tier: '黄金',
      tierClass: 'tier-gold',
      color: '#faad14'
    };
  } else if (points >= 600) {
    return {
      tier: '白银',
      tierClass: 'tier-silver',
      color: '#8c8c8c'
    };
  } else {
    return {
      tier: '青铜',
      tierClass: 'tier-bronze',
      color: '#a6754b'
    };
  }
};

const app = getApp();

// 添加管理员手机号列表
const ADMIN_PHONES = ['输入管理员手机号'];

Page({
  data: {
    messages: [],
    inputMessage: '',
    isLoading: false,
    lastMessageId: '',
    pageSize: 20,
    currentPage: 1,
    hasMore: true,
    userInfo: null,
    darkMode: false,
    defaultAvatar: 'https://api.hsbogk.icu/mini-programs/images/default-avatar.png',
    showMenu: false,
    menuPosition: { x: 0, y: 0 },
    selectedMessage: null,
    replyTo: null,
    isAdmin: false,  // 添加管理员标识
    showRedPacketModal: false, // 添加红包模态框显示状态
    redPacketAmount: '', // 红包总积分
    redPacketCount: '', // 红包个数
    userPoints: 0, // 用户当前积分
    isSending: false, // 添加发送状态控制
    isGrabbing: false, // 添加抢红包状态控制
    scrollToBottom: true, // 添加是否自动滚动到底部的标志
    targetPhoneNumber: '添加管理员手机号', // 添加指定手机号字段
    wrongQuestions: [], // 添加错题本相关数据
  },

  onLoad() {
    // 获取用户信息
    const app = getApp();
    const userInfo = app.globalData.userInfo;

    // 检查是否是管理员
    const isAdmin = userInfo && userInfo.phoneNumber && ADMIN_PHONES.includes(userInfo.phoneNumber);

    // 初始化云环境
    wx.cloud.init({
      env: 'tiku-9g3b4q2sb14221f7',
      traceUser: true
    });

    // 初始化云数据库
    this.db = wx.cloud.database();

    this.setData({
      userInfo,
      darkMode: wx.getStorageSync('darkMode') || false,
      isAdmin,
      defaultAvatar: 'https://api.hsbogk.icu/mini-programs/images/default-avatar.png'
    });

    // 加载消息
    this.loadMessages();

    // 监听新消息
    this.watchMessages();

    // 获取用户积分
    this.getUserPoints();

    // 页面加载完成后滚动到底部
    this.scrollToBottom();
  },

  // 获取用户积分
  async getUserPoints() {
    try {
      const { data } = await this.db.collection('users').doc(this.data.userInfo._id).get();
      this.setData({
        userPoints: data.points || 0
      });
    } catch (err) {
      console.error('获取用户积分失败：', err);
    }
  },

  // 处理云存储头像链接
  async processAvatarUrl(avatarUrl) {
    if (!avatarUrl) return 'https://api.hsbogk.icu/weix/images/default-avatar.png';

    // 如果是http链接，直接返回
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return avatarUrl;
    }

    try {
      // 获取临时链接
      const { fileList } = await wx.cloud.getTempFileURL({
        fileList: [avatarUrl]
      });

      if (fileList?.[0]?.tempFileURL) {
        return fileList[0].tempFileURL;
      }
    } catch (error) {
      console.error('获取头像临时链接失败:', error);
    }

    // 如果获取失败，返回默认头像
    return 'https://api.hsbogk.icu/weix/images/default-avatar.png';
  },

  // 预加载头像
  async preloadAvatars(messages) {
    const avatarUrls = [...new Set(messages.map(msg => msg.userAvatar))];
    await Promise.all(avatarUrls.map(async (avatarUrl) => {
      if (avatarUrl && avatarUrl.startsWith('cloud://')) {
        await this.processAvatarUrl(avatarUrl);
      }
    }));
  },

  // 刷新消息列表中的头像链接
  async refreshAvatarUrls() {
    try {
      const messages = [...this.data.messages];
      const updatedMessages = await Promise.all(messages.map(async (msg) => {
        if (msg.userAvatar && msg.userAvatar.startsWith('cloud://')) {
          const processedAvatarUrl = await this.processAvatarUrl(msg.userAvatar);
          return { ...msg, userAvatar: processedAvatarUrl };
        }
        return msg;
      }));

      this.setData({ messages: updatedMessages });
    } catch (error) {
      console.error('刷新头像链接失败:', error);
      wx.showToast({
        title: '刷新头像失败',
        icon: 'none'
      });
    }
  },

  onShow() {
    // 页面显示时刷新头像链接
    this.refreshAvatarUrls();
  },

  // 加载消息
  async loadMessages() {
    if (!this.data.hasMore || this.data.isLoading) return;

    this.setData({ isLoading: true });

    try {
      const { data } = await this.db.collection('chat_messages')
        .orderBy('createTime', 'desc')
        .skip((this.data.currentPage - 1) * this.data.pageSize)
        .limit(this.data.pageSize)
        .get();

      // 获取所有消息用户的积分信息
      const userIds = [...new Set(data.map(msg => msg.userId))];
      const usersData = await this.db.collection('users')
        .where({
          _id: this.db.command.in(userIds)
        })
        .field({
          _id: true,
          points: true
        })
        .get();

      const usersPoints = {};
      usersData.data.forEach(user => {
        usersPoints[user._id] = user.points || 0;
      });

      // 格式化时间和处理消息
      const formattedMessages = await Promise.all(data.map(async msg => {
        const points = usersPoints[msg.userId] || 0;
        const tierInfo = getTierInfo(points);

        // 处理头像URL - 只有自己的消息显示真实头像，其他人显示默认头像
        let avatarUrl = this.data.defaultAvatar;
        if (msg.userId === this.data.userInfo._id) {
          if (msg.userAvatar && !msg.userAvatar.startsWith('http')) {
            avatarUrl = await this.processAvatarUrl(msg.userAvatar);
          } else {
            avatarUrl = msg.userAvatar || this.data.defaultAvatar;
          }
        }

        return {
          ...msg,
          _id: msg._id,
          createTime: this.formatTime(msg.createTime),
          userNickname: msg.userNickname || '未知用户',
          userAvatar: avatarUrl,
          tierInfo
        };
      }));

      this.setData({
        messages: [...formattedMessages.reverse(), ...this.data.messages],
        currentPage: this.data.currentPage + 1,
        hasMore: data.length === this.data.pageSize,
        isLoading: false
      });

    } catch (err) {
      console.error('加载消息失败：', err);
      this.setData({ isLoading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 监听新消息
  watchMessages() {
    this.messageListener = this.db.collection('chat_messages')
      .orderBy('createTime', 'desc')
      .limit(1)
      .watch({
        onChange: async (snapshot) => {
          if (snapshot.type === 'init') return;

          const { docs } = snapshot;
          if (docs && docs.length > 0) {
            // 获取用户积分信息
            try {
              const { data: userData } = await this.db.collection('users')
                .where({
                  _id: docs[0].userId
                })
                .field({
                  _id: true,
                  points: true
                })
                .get();

              const points = userData[0]?.points || 0;
              const tierInfo = getTierInfo(points);

              // 处理头像URL - 只有自己的消息显示真实头像
              let avatarUrl = this.data.defaultAvatar;
              if (docs[0].userId === this.data.userInfo._id) {
                if (docs[0].userAvatar && !docs[0].userAvatar.startsWith('http')) {
                  avatarUrl = await this.processAvatarUrl(docs[0].userAvatar);
                } else {
                  avatarUrl = docs[0].userAvatar || this.data.defaultAvatar;
                }
              }

              const newMessage = {
                ...docs[0],
                _id: docs[0]._id,
                createTime: this.formatTime(docs[0].createTime),
                userAvatar: avatarUrl,
                tierInfo
              };

              // 如果是更新操作（撤回），更新现有消息
              const existingMessageIndex = this.data.messages.findIndex(
                msg => msg._id === newMessage._id
              );

              if (existingMessageIndex !== -1) {
                const messages = [...this.data.messages];
                messages[existingMessageIndex] = newMessage;
                this.setData({ messages });
              } else {
                // 如果是新消息，添加到列表末尾
                this.setData({
                  messages: [...this.data.messages, newMessage],
                  lastMessageId: `msg-${newMessage._id}`
                }, () => {
                  // 如果允许自动滚动，则滚动到底部
                  if (this.data.scrollToBottom) {
                    this.scrollToBottom();
                  } else {
                    // 显示新消息提示
                    wx.showToast({
                      title: '收到新消息',
                      icon: 'none',
                      duration: 1000
                    });
                  }
                });
              }
            } catch (err) {
              console.error('获取用户积分失败：', err);
            }
          }
        },
        onError: (err) => {
          console.error('监听消息失败：', err);
        }
      });
  },

  // 发送消息
  async sendMessage() {
    if (this.data.isSending) return;

    const content = this.data.inputMessage.trim();
    if (!content) return;

    this.setData({ isSending: true });

    try {
      // 获取用户最新积分
      const { data: userData } = await this.db.collection('users')
        .where({
          _id: this.data.userInfo._id
        })
        .field({
          points: true
        })
        .get();

      const points = userData[0]?.points || 0;
      const tierInfo = getTierInfo(points);

      const message = {
        content,
        userId: this.data.userInfo._id,
        userAvatar: this.data.userInfo.avatarUrl || this.data.defaultAvatar,
        userNickname: this.data.userInfo.nickName,
        createTime: new Date(),
        tierInfo
      };

      // 如果是回复消息，添加回复信息
      if (this.data.replyTo) {
        message.replyTo = this.data.replyTo;
      }

      await this.db.collection('chat_messages').add({
        data: message
      });

      this.setData({
        inputMessage: '',
        replyTo: null,
        isSending: false,
        scrollToBottom: true // 发送消息后自动滚动到底部
      }, () => {
        this.scrollToBottom();
      });

    } catch (err) {
      console.error('发送消息失败：', err);
      wx.showToast({
        title: '发送失败',
        icon: 'none'
      });
      this.setData({ isSending: false }); // 发送失败也要重置状态
    }
  },

  // 输入框变化
  onInputChange(e) {
    this.setData({
      inputMessage: e.detail.value
    });
  },

  // 加载更多消息
  loadMoreMessages() {
    if (this.data.hasMore) {
      this.loadMessages();
    }
  },

  // 格式化时间
  formatTime(date) {
    date = new Date(date);
    const now = new Date();
    const diff = now - date;
    const minute = 1000 * 60;
    const hour = minute * 60;
    const day = hour * 24;

    if (diff < minute) {
      return '刚刚';
    } else if (diff < hour) {
      return Math.floor(diff / minute) + '分钟前';
    } else if (diff < day) {
      return Math.floor(diff / hour) + '小时前';
    } else if (diff < day * 2) {
      return '昨天';
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
  },

  onUnload() {
    // 关闭消息监听
    if (this.messageListener) {
      this.messageListener.close();
    }
  },

  // 显示消息菜单
  showMessageMenu(e) {
    const message = e.currentTarget.dataset.message;
    const { clientX, clientY } = e.touches[0];

    // 检查是否可以撤回消息
    const canRecall = this.canRecallMessage(message);

    if (!canRecall) {
      if (message.userId === this.data.userInfo._id) {
        wx.showToast({
          title: '只能撤回2分钟内的消息',
          icon: 'none'
        });
      }
      return;
    }

    this.setData({
      showMenu: true,
      menuPosition: {
        x: clientX,
        y: clientY
      },
      selectedMessage: message
    });
  },

  // 检查是否可以撤回消息
  canRecallMessage(message) {
    // 如果是管理员，可以撤回任何消息
    if (this.data.isAdmin) {
      return true;
    }

    // 如果是自己的消息，检查2分钟时限
    if (message.userId === this.data.userInfo._id) {
      const now = new Date();
      const messageTime = new Date(message.createTime);
      const diffMinutes = (now - messageTime) / (1000 * 60);
      return diffMinutes <= 2;
    }

    return false;
  },

  // 隐藏消息菜单
  hideMessageMenu() {
    this.setData({
      showMenu: false,
      selectedMessage: null
    });
  },

  // 撤回消息
  async recallMessage() {
    const message = this.data.selectedMessage;
    if (!message) return;

    try {
      // 更新云数据库中的消息状态
      await this.db.collection('chat_messages').doc(message._id).update({
        data: {
          isRecalled: true,
          recallTime: new Date()
        }
      });

      // 更新本地消息列表
      const messages = this.data.messages.filter(msg => msg._id !== message._id);

      this.setData({
        messages,
        showMenu: false,
        selectedMessage: null
      });

      wx.showToast({
        title: '已撤回',
        icon: 'success'
      });

    } catch (err) {
      console.error('撤回消息失败：', err);
      wx.showToast({
        title: '撤回失败',
        icon: 'none'
      });
    }
  },

  // 回复消息
  replyMessage() {
    const message = this.data.selectedMessage;
    if (!message) return;

    this.setData({
      replyTo: {
        _id: message._id,
        userId: message.userId,
        userNickname: message.userNickname,
        content: message.content
      },
      showMenu: false,
      selectedMessage: null
    });
  },

  // 取消回复
  cancelReply() {
    this.setData({
      replyTo: null
    });
  },

  // 显示发红包模态框
  showRedPacketDialog() {
    this.setData({
      showRedPacketModal: true
    });
  },

  // 隐藏发红包模态框
  hideRedPacketDialog() {
    this.setData({
      showRedPacketModal: false,
      redPacketAmount: '',
      redPacketCount: '',
      targetPhoneNumber: '' // 清空指定手机号
    });
  },

  // 添加手机号输入处理
  onTargetPhoneInput(e) {
    this.setData({
      targetPhoneNumber: e.detail.value
    });
  },

  // 输入红包金额
  onRedPacketAmountInput(e) {
    this.setData({
      redPacketAmount: e.detail.value
    });
  },

  // 输入红包个数
  onRedPacketCountInput(e) {
    this.setData({
      redPacketCount: e.detail.value
    });
  },

  // 发送红包
  async sendRedPacket() {
    // 删除整个函数内容
  },

  // 领取红包
  async grabRedPacket(e) {
    if (this.data.isGrabbing) return;

    const redPacketId = e.currentTarget.dataset.redPacketId;
    const userId = this.data.userInfo._id;

    this.setData({ isGrabbing: true });

    try {
      // 1. 获取红包信息并检查状态
      const { data: redPacket } = await this.db.collection('red_packets').doc(redPacketId).get();

      if (redPacket.status !== 'active') {
        wx.showToast({
          title: '红包已被抢完',
          icon: 'none'
        });
        return;
      }

      // 检查是否是专属红包
      if (redPacket.targetUserId && redPacket.targetUserId !== userId) {
        wx.showToast({
          title: '这是别人的专属红包',
          icon: 'none'
        });
        return;
      }

      if (redPacket.receivers.includes(userId)) {
        wx.showToast({
          title: '您已领取过该红包',
          icon: 'none'
        });
        return;
      }

      // 2. 获取红包金额
      const amount = redPacket.amounts[redPacket.count - redPacket.remainingCount];

      try {
        // 3. 更新红包状态
        const newRemainingAmount = redPacket.remainingAmount - amount;
        const newRemainingCount = redPacket.remainingCount - 1;
        const newStatus = newRemainingCount === 0 ? 'finished' : 'active';

        await this.db.collection('red_packets').doc(redPacketId).update({
          data: {
            remainingAmount: newRemainingAmount,
            remainingCount: newRemainingCount,
            receivers: this.db.command.push(userId),
            status: newStatus
          }
        });

        // 4. 增加用户积分
        await this.db.collection('users').doc(userId).update({
          data: {
            points: this.db.command.inc(amount)
          }
        });

        // 5. 更新消息中的剩余积分信息
        await this.db.collection('chat_messages').where({
          redPacketId: redPacketId
        }).update({
          data: {
            remainingAmount: newRemainingAmount,
            remainingCount: newRemainingCount
          }
        });

        // 6. 更新本地积分显示
        this.setData({
          userPoints: this.data.userPoints + amount,
          isGrabbing: false
        });

        wx.showToast({
          title: `获得${amount}积分`,
          icon: 'success'
        });

      } catch (err) {
        // 如果发生错误，尝试回滚
        console.error('领取红包失败，尝试回滚：', err);

        try {
          // 恢复红包状态
          await this.db.collection('red_packets').doc(redPacketId).update({
            data: {
              remainingAmount: redPacket.remainingAmount,
              remainingCount: redPacket.remainingCount,
              receivers: redPacket.receivers,
              status: redPacket.status
            }
          });
        } catch (rollbackErr) {
          console.error('回滚失败：', rollbackErr);
        }

        throw err;
      }

    } catch (err) {
      console.error('领取红包失败：', err);
      wx.showToast({
        title: err.errMsg || '领取失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isGrabbing: false });
    }
  },

  // 添加滚动到底部方法
  scrollToBottom() {
    if (!this.data.scrollToBottom) return;

    setTimeout(() => {
      const query = wx.createSelectorQuery();
      query.select('.message-list').boundingClientRect();
      query.exec(res => {
        if (res && res[0]) {
          wx.pageScrollTo({
            scrollTop: res[0].height,
            duration: 300
          });
        }
      });
    }, 300);
  },

  // 监听滚动事件
  onScroll(e) {
    const { scrollTop, scrollHeight } = e.detail;
    // 如果用户向上滚动超过200px，则暂停自动滚动
    this.setData({
      scrollToBottom: scrollHeight - scrollTop < 200
    });
  },

  // 添加点击回到底部方法
  goToBottom() {
    this.setData({ scrollToBottom: true }, () => {
      this.scrollToBottom();
    });
  },

  // 生成红包金额列表
  generateRedPacketAmounts(totalAmount, count) {
    // 删除整个函数内容
  },
}); 