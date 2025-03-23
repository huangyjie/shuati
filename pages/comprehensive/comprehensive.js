const app = getApp()
const db = wx.cloud.database()
const _ = db.command

// 敏感词列表
const sensitiveWords = [
  '习近平', '毛泽东', '江泽民', '胡锦涛', '邓小平',
  '共产党', '国民党', '法轮功', '反共', '反党',
  '色情', '赌博', '毒品', '黄赌毒',
  '傻逼', '妈的', '操你', '垃圾', '废物',
  'admin', 'administrator', '管理员', '系统管理员',
  '习大大', '习主席', '总书记',
  '暴力', '恐怖', '极端', '分裂', '煽动',
  // 新增50个敏感词
  '独裁', '专制', '独裁者', '独裁统治', '独裁政府',
  '暴政', '暴君', '暴力革命', '暴力事件', '暴力行为',
  '恐怖主义', '恐怖分子', '恐怖袭击', '恐怖活动', '恐怖组织',
  '极端主义', '极端分子', '极端行为', '极端思想', '极端组织',
  '分裂主义', '分裂分子', '分裂活动', '分裂国家', '分裂组织',
  '煽动暴乱', '煽动叛乱', '煽动仇恨', '煽动分裂', '煽动暴力',
  '反动', '反动派', '反动思想', '反动势力', '反动组织',
  '颠覆', '颠覆国家', '颠覆政权', '颠覆活动', '颠覆组织',
  '非法集会', '非法组织', '非法活动', '非法行为', '非法交易',
  '走私', '贩毒', '洗钱', '贪污', '腐败',
  '黑社会', '黑帮', '黑市', '黑幕', '黑手党',
  '反革命', '反革命组织', '反革命活动', '反革命思想', '反革命势力',
  'https?:\/\/[^\s]+', // 匹配以http或https开头的网址
  '\.[a-z]{2,6}$',    // 匹配顶级域名
  // 新增骂人的话
  '傻瓜', '笨蛋', '蠢货', '白痴', '混蛋', '王八蛋', '猪头', '狗屎', '废柴', '蠢材',
  '白痴', '饭桶', '废物', '蠢蛋', '二百五', '脑残', '脑瘫', '脑子进水', '脑袋有包', '脑袋进水',
  '傻逼', '妈的', '操你', '垃圾', '废物', '狗东西', '猪脑子', '蠢猪', '废物点心', '人渣',
  '贱人', '人渣', '混账', '王八', '杂种', '畜生', '死猪', '猪狗不如', '无耻', '卑鄙',
  '下流', '无赖', '人面兽心', '猪狗不如', '不要脸', '厚颜无耻', '死不要脸', '厚脸皮', '无耻下流',

  // 竞品相关
  '应知刷题', '准易', '万维', 'cnm', '刷题狗', '题库通', '题霸', '考试通', '考试帮', '考试酷',
  '考试宝', '考试星', '考试通关', '考试达人', '考试王', '考试助手', '考试专家', '考试大师',
  '考试高手', '考试能手', '考试达人', '考试状元', '考试冠军', '考试之星', '考试精英',

  // 色情暴力
  '色情', '暴力', '血腥', '淫秽', '色魔', '色狼', '色鬼', '色胆', '色心', '色欲',
  '淫乱', '淫荡', '淫邪', '淫靡', '淫亵', '淫猥', '淫秽', '淫贱', '淫浪', '淫娃',

  // 赌博诈骗
  '赌博', '赌场', '赌资', '赌徒', '赌具', '赌窝', '赌档', '赌坊', '赌钱', '赌博机',
  '诈骗', '欺诈', '骗子', '骗局', '骗术', '骗钱', '骗人', '骗取', '骗财', '骗色',

  // 毒品
  '毒品', '吸毒', '贩毒', '制毒', '毒贩', '毒枭', '毒窝', '毒瘾', '毒鬼', '毒品交易',
  '大麻', '海洛因', '冰毒', '摇头丸', '可卡因', '麻古', 'K粉', '白粉', '冰糖', '摇头',

  // 其他违法
  '造假', '假证', '假钞', '假币', '假钱', '假发票', '假文凭', '假学历', '假证件', '假护照',
  '盗版', '盗窃', '盗取', '盗用', '盗卖', '盗抢', '盗贼', '盗墓', '盗采', '盗挖'
];

// 检查是否包含敏感词
function containsSensitiveWords(text) {
  if (!text) return false;
  return sensitiveWords.some(word => text.toLowerCase().includes(word.toLowerCase()));
}

// 检查用户名是否合法
function isValidUsername(username) {
  // 检查是否为空
  if (!username) {
    return {
      valid: false,
      message: '用户名不能为空'
    };
  }

  // 检查长度是否在2-8个字符之间
  if (username.length < 2 || username.length > 8) {
    return {
      valid: false,
      message: '用户名长度必须在2-8个字符之间'
    };
  }

  // 检查是否只包含中文字符
  const chineseRegex = /^[\u4e00-\u9fa5]+$/;
  if (!chineseRegex.test(username)) {
    return {
      valid: false,
      message: '用户名只能使用中文'
    };
  }

  return {
    valid: true,
    message: ''
  };
}

Page({
  data: {
    iconBaseUrl: getApp().globalData.iconBaseUrl,
    darkMode: false,
    wrongCount: 0,
    favoriteCount: 0,
    isLogin: false,
    userInfo: null,
    signDays: 0,
    completedQuestions: 0,
    statusBarHeight: wx.getSystemInfoSync().statusBarHeight,
    tempUserInfo: {
      phoneNumber: '',
      nickName: '',
      avatarUrl: ''
    },
    showPhoneAuth: false,
    myRanking: null,
    topUsers: [],
    showLoginModal: false,
    isRegister: false,
    showRulesModal: false,
    showFindUsername: false,
    findPhoneNumber: '',
    foundUsername: '',
    resetCount: 0,
    maxResetTimes: 3,
    isAdmin: false,
    adminPhones: ['输入管理员手机号'],  // 管理员手机号列表
    isLongPressing: false,
    logoutProgress: 0,
    logoutCountdown: 20,
    logoutTimer: null,
    progressTimer: null,
    showEditModal: false,
    showSignInCalendar: false,
    calendarDays: [],
    signInDays: 0,
    consecutiveDays: 0,
    todaySigned: false,
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    availableReward: null,
    showRewardModal: false,
    availableRewards: [],
    isCollecting: false,
    userStats: {
      totalQuestions: 0,
      correctRate: 0
    },
    hasUnCollectedRewards: false,
    showFrameModal: false,
    showAccountModal: false, // 添加账号管理弹窗显示状态
    showLogoutConfirm: false,
    logoutConfirmText: '',
  },

  // 跳转到管理员后台
  goToAdmin() {
    if (!this.data.isAdmin) {
      wx.showToast({
        title: '无权限访问',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/admin/admin',
      fail: (err) => {
        console.error('跳转管理员页面失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 检查是否是管理员
  checkAdminStatus(phoneNumber) {
    const isAdmin = this.data.adminPhones.includes(phoneNumber);
    // 更新data中的isAdmin状态
    this.setData({
      isAdmin: isAdmin
    });
    return isAdmin;
  },

  // 检查用户数据是否存在于云数据库
  async checkUserExistsInCloud() {
    try {
      const authInfo = wx.getStorageSync('authInfo');
      if (!authInfo || !authInfo.isLogin || !authInfo.userInfo || !authInfo.userInfo.phoneNumber) {
        return;
      }

      const db = wx.cloud.database();
      const { data: users } = await db.collection('users')
        .where({
          phoneNumber: authInfo.userInfo.phoneNumber
        })
        .get();

      if (users.length === 0) {
        console.log('用户数据在云数据库中不存在，清理本地缓存');
        // 清理所有本地缓存
        wx.clearStorageSync();

        // 更新页面状态
        this.setData({
          isLogin: false,
          userInfo: null,
          points: 0,
          myRanking: '-',
          signInDays: 0,
          consecutiveDays: 0,
          wrongCount: 0,
          favoriteCount: 0,
          isAdmin: false
        });

        // 更新全局状态
        const app = getApp();
        app.globalData.isLogin = false;
        app.globalData.userInfo = null;

        wx.showToast({
          title: '登录状态已失效',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('检查用户数据失败:', err);
    }
  },

  onLoad() {
    const app = getApp();

    // 检查本地存储的登录状态
    const authInfo = wx.getStorageSync('authInfo');
    if (authInfo && authInfo.isLogin && authInfo.userInfo) {
      // 恢复登录状态
      app.globalData.isLogin = true;
      app.globalData.userInfo = authInfo.userInfo;

      // 检查是否是管理员账户
      const isAdmin = this.checkAdminStatus(authInfo.userInfo.phoneNumber);

      this.setData({
        isLogin: true,
        userInfo: authInfo.userInfo,
        isAdmin,
        resetCount: isAdmin ? 0 : (authInfo.userInfo.resetCount || 0), // 如果是管理员，重置次数为0
        maxResetTimes: isAdmin ? 999999 : 3 // 如果是管理员，设置一个很大的最大重置次数
      });

      // 检查用户数据是否存在于云数据库
      this.checkUserExistsInCloud();

      // 加载用户数据
      this.loadUserData(authInfo.userInfo.phoneNumber);
    }

    // 设置夜间模式
    const darkMode = wx.getStorageSync('darkMode') || false;
    this.setData({
      darkMode
    });

    // 更新导航栏颜色
    this.updateNavigationBarColor();

    // 加载排行榜数据
    this.loadRankingData();

    // 加载前三名数据
    this.loadTopThree();

    // 获取重置次数
    if (this.data.isLogin && this.data.userInfo) {
      this.loadResetCount();
    }

    // 从本地获取错题本和收藏数量
    this.loadLocalCounts();
  },

  // 计算段位进度和下一段位信息
  calculateTierProgress(points) {
    let nextTierPoints;
    let currentTierMinPoints;
    let nextTierText;

    if (points >= 5000) {
      // 至尊段位
      nextTierText = '已达最高段位';
      return {
        tierProgress: 100,
        nextTierText
      };
    } else if (points >= 3600) {
      // 王者段位
      currentTierMinPoints = 3600;
      nextTierPoints = 5000;
      nextTierText = '距离至尊还需' + (nextTierPoints - points) + '分';
    } else if (points >= 3000) {
      // 大师段位
      currentTierMinPoints = 3000;
      nextTierPoints = 3600;
      nextTierText = '距离王者还需' + (nextTierPoints - points) + '分';
    } else if (points >= 2400) {
      // 钻石段位
      currentTierMinPoints = 2400;
      nextTierPoints = 3000;
      nextTierText = '距离大师还需' + (nextTierPoints - points) + '分';
    } else if (points >= 1800) {
      // 铂金段位
      currentTierMinPoints = 1800;
      nextTierPoints = 2400;
      nextTierText = '距离钻石还需' + (nextTierPoints - points) + '分';
    } else if (points >= 1200) {
      // 黄金段位
      currentTierMinPoints = 1200;
      nextTierPoints = 1800;
      nextTierText = '距离铂金还需' + (nextTierPoints - points) + '分';
    } else if (points >= 600) {
      // 白银段位
      currentTierMinPoints = 600;
      nextTierPoints = 1200;
      nextTierText = '距离黄金还需' + (nextTierPoints - points) + '分';
    } else {
      // 青铜段位
      currentTierMinPoints = 0;
      nextTierPoints = 600;
      nextTierText = '距离白银还需' + (nextTierPoints - points) + '分';
    }

    // 计算进度百分比
    const tierProgress = ((points - currentTierMinPoints) / (nextTierPoints - currentTierMinPoints) * 100).toFixed(1);

    return {
      tierProgress,
      nextTierText
    };
  },

  // 修改加载用户数据的方法
  async loadUserData(phoneNumber, forceRefresh = false) {
    try {
      console.log('开始加载用户数据，手机号:', phoneNumber);

      // 如果不是强制刷新，且已有缓存数据，直接使用缓存
      const cacheKey = `userData_${phoneNumber}`;
      const cachedData = wx.getStorageSync(cacheKey);
      if (!forceRefresh && cachedData && Date.now() - cachedData.timestamp < 300000) { // 5分钟缓存
        this.updateUserInfo(cachedData.data);
        return;
      }

      const db = wx.cloud.database();
      const { data: users } = await db.collection('users')
        .where({
          phoneNumber: phoneNumber
        })
        .get();

      if (users.length === 0) {
        console.log('未找到用户数据');
        // 清理所有本地缓存
        wx.clearStorageSync();

        // 更新页面状态
        this.setData({
          isLogin: false,
          userInfo: null,
          points: 0,
          myRanking: '-',
          signInDays: 0,
          consecutiveDays: 0,
          wrongCount: 0,
          favoriteCount: 0,
          isAdmin: false
        });

        // 更新全局状态
        const app = getApp();
        app.globalData.isLogin = false;
        app.globalData.userInfo = null;

        wx.showToast({
          title: '登录状态已失效',
          icon: 'none',
          duration: 2000,
          complete: () => {
            // 延迟一下再重载页面，让用户看到提示
            setTimeout(() => {
              wx.reLaunch({
                url: '/pages/comprehensive/comprehensive'
              });
            }, 1500);
          }
        });
        return;
      }

      const user = users[0];
      console.log('查询到的用户数据:', users);

      // 获取用户积分
      const points = user.points || 0;
      console.log('用户当前积分:', points);

      // 获取用户排名
      const { total } = await db.collection('users')
        .where({
          points: _.gt(points)
        })
        .count();

      const myRanking = total + 1;
      console.log('用户当前排名:', myRanking);

      // 计算段位
      let tier = '';
      let tierClass = '';

      if (points >= 5000) {
        tier = '至尊';
        tierClass = 'tier-supreme';
      } else if (points >= 3600) {
        tier = '王者';
        tierClass = 'tier-king';
      } else if (points >= 3000) {
        tier = '大师';
        tierClass = 'tier-master';
      } else if (points >= 2400) {
        tier = '钻石';
        tierClass = 'tier-diamond';
      } else if (points >= 1800) {
        tier = '铂金';
        tierClass = 'tier-platinum';
      } else if (points >= 1200) {
        tier = '黄金';
        tierClass = 'tier-gold';
      } else if (points >= 600) {
        tier = '白银';
        tierClass = 'tier-silver';
      } else {
        tier = '青铜';
        tierClass = 'tier-bronze';
      }

      // 计算段位进度
      const { tierProgress, nextTierText } = this.calculateTierProgress(points);

      console.log('计算的段位信息:', {
        tier,
        tierClass,
        tierProgress,
        nextTierText
      });

      // 检查今日是否已签到
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastSignInDate = user.lastSignInDate ? new Date(user.lastSignInDate) : null;
      const todaySigned = lastSignInDate ? lastSignInDate.toDateString() === today.toDateString() : false;

      // 更新页面数据
      this.setData({
        points,
        myRanking,
        userInfo: {
          ...user,
          points,
          tier,
          tierClass
        },
        tierProgress,
        nextTierText,
        signInDays: user.signInDays || 0,
        consecutiveDays: user.consecutiveDays || 0,
        todaySigned,
        signDays: user.signInDays || 0  // 确保signDays和signInDays保持一致
      });

      console.log('更新后的页面数据:', {
        points,
        myRanking,
        signInDays: user.signInDays || 0,
        consecutiveDays: user.consecutiveDays || 0,
        todaySigned
      });

      // 更新全局数据
      const app = getApp();
      app.globalData.userInfo = {
        ...app.globalData.userInfo,
        ...user,
        points,
        tier,
        tierClass
      };

      console.log('用户数据加载完成');
      return user;

    } catch (err) {
      console.error('加载用户数据失败:', err);
      wx.showToast({
        title: '加载用户数据失败',
        icon: 'none'
      });
    }
  },

  // 修改登录成功后的处理
  async doLogin() {
    try {
      const { phoneNumber } = this.data.tempUserInfo;

      if (!phoneNumber || !/^1[3-9]\d{9}$/.test(phoneNumber)) {
        wx.showToast({
          title: '请输入正确的手机号',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '登录中...',
        mask: true
      });

      const db = wx.cloud.database();
      const { data: users } = await db.collection('users')
        .where({ phoneNumber })
        .get();

      if (users.length === 0) {
        wx.hideLoading();
        wx.showToast({
          title: '账号不存在',
          icon: 'none'
        });
        return;
      }

      const user = users[0];

      // 检查是否是管理员
      const isAdmin = this.checkAdminStatus(phoneNumber);

      // 更新全局用户信息
      const app = getApp();
      app.globalData.isLogin = true;
      app.globalData.userInfo = user;

      // 保存登录状态
      wx.setStorageSync('authInfo', {
        isLogin: true,
        userInfo: user
      });

      // 立即加载用户数据
      await this.loadUserData(phoneNumber);

      wx.hideLoading();
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });

      this.setData({
        showLoginModal: false,
        isLogin: true,
        userInfo: user,
        isAdmin
      });

    } catch (err) {
      console.error('登录失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      });
    }
  },

  // 修改注册成功后的处理
  async handleRegister() {
    try {
      const { phoneNumber, nickName, avatarUrl } = this.data.tempUserInfo;

      // 验证输入
      if (!phoneNumber || !/^1[3-9]\d{9}$/.test(phoneNumber)) {
        wx.showToast({
          title: '请输入正确的手机号',
          icon: 'none'
        });
        return;
      }

      // 验证用户名
      const validation = isValidUsername(nickName);
      if (!validation.valid) {
        wx.showToast({
          title: validation.message,
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '注册中...',
        mask: true
      });

      const db = wx.cloud.database();

      // 检查手机号是否已注册
      const userResult = await db.collection('users')
        .where({ phoneNumber })
        .get();

      if (userResult.data && userResult.data.length > 0) {
        wx.hideLoading();
        wx.showToast({
          title: '手机号已注册',
          icon: 'none'
        });
        return;
      }

      // 检查用户名是否已存在
      const nicknameResult = await db.collection('users')
        .where({ nickName })
        .get();

      if (nicknameResult.data && nicknameResult.data.length > 0) {
        wx.hideLoading();
        wx.showToast({
          title: '用户名已被使用',
          icon: 'none'
        });
        return;
      }

      // 创建新用户
      const addResult = await db.collection('users').add({
        data: {
          phoneNumber,
          nickName,
          avatarUrl: avatarUrl || this.data.iconBaseUrl + '/default-avatar.png',
          totalQuestions: 0,
          correctQuestions: 0,
          wrongQuestions: 0,
          points: 0,
          signDays: 0,
          createTime: db.serverDate()
        }
      });

      if (!addResult._id) {
        throw new Error('创建用户失败');
      }

      // 获取新创建的用户信息
      const newUserResult = await db.collection('users')
        .doc(addResult._id)
        .get();

      if (!newUserResult.data) {
        throw new Error('获取用户信息失败');
      }

      const newUser = newUserResult.data;

      // 检查是否是管理员
      const isAdmin = this.checkAdminStatus(phoneNumber);

      // 更新全局用户信息
      const app = getApp();
      app.globalData.isLogin = true;
      app.globalData.userInfo = newUser;

      // 保存登录状态
      wx.setStorageSync('authInfo', {
        isLogin: true,
        userInfo: newUser
      });

      wx.hideLoading();
      wx.showToast({
        title: '注册成功',
        icon: 'success'
      });

      this.setData({
        showLoginModal: false,
        isLogin: true,
        userInfo: newUser,
        isAdmin
      });

    } catch (err) {
      console.error('注册失败:', err);
      wx.hideLoading();

      // 再次检查用户是否已存在
      try {
        const db = wx.cloud.database();
        const userResult = await db.collection('users')
          .where({ phoneNumber })
          .get();

        if (userResult.data && userResult.data.length > 0) {
          wx.showToast({
            title: '手机号已注册',
            icon: 'none'
          });
        } else {
          wx.showToast({
            title: '注册失败，请重试',
            icon: 'none'
          });
        }
      } catch (checkError) {
        wx.showToast({
          title: '注册失败，请重试',
          icon: 'none'
        });
      }
    }
  },

  // 检查每日任务完成情况
  checkDailyTask() {
    const today = new Date().toLocaleDateString();
    const dailyTask = wx.getStorageSync('dailyTask') || {};

    if (dailyTask.date === today) {
      this.setData({
        completedQuestions: dailyTask.completedQuestions || 0
      });
    } else {
      // 新的一天，重置任务
      wx.setStorageSync('dailyTask', {
        date: today,
        completedQuestions: 0
      });
      this.setData({
        completedQuestions: 0
      });
    }
  },

  // 显示登录弹窗的方法
  showLoginModal() {
    console.log('点击登录按钮');
    this.setData({
      showLoginModal: true,
      isRegister: false,
      tempUserInfo: {
        phoneNumber: '',
        nickName: '',
        avatarUrl: ''
      }
    }, () => {
      console.log('登录弹窗状态:', this.data.showLoginModal);
    });
  },

  // 隐藏登录弹窗
  hideLoginModal() {
    this.setData({
      showLoginModal: false
    });
  },

  // 切换登录/注册模式
  switchAuthMode() {
    this.setData({
      isRegister: !this.data.isRegister,
      tempUserInfo: {
        phoneNumber: '',
        nickName: '',
        avatarUrl: ''
      }
    });
  },

  // 理手机号输入
  handlePhoneInput(e) {
    const phoneNumber = e.detail.value.replace(/\D/g, '').slice(0, 11);
    this.setData({
      'tempUserInfo.phoneNumber': phoneNumber
    });
  },

  // 处理用户名输入
  handleNicknameInput(e) {
    const value = e.detail.value;
    // 只保留中文字符
    const chineseValue = value.replace(/[^\u4e00-\u9fa5]/g, '');
    this.setData({
      'tempUserInfo.nickName': chineseValue
    });
  },

  // 选择头像
  async chooseAvatar() {
    try {
      const { tempFilePaths } = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      if (tempFilePaths && tempFilePaths[0]) {
        // 上传图片到云存储
        wx.showLoading({ title: '上传中...' });
        const cloudPath = `avatars/${this.data.userInfo._openid || Date.now()}_${Math.random().toString(36).slice(-6)}.jpg`;
        const { fileID } = await wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFilePaths[0]
        });

        this.setData({
          'tempUserInfo.avatarUrl': fileID
        });
        wx.hideLoading();
      }
    } catch (err) {
      console.error('选择头像失败:', err);
      wx.showToast({
        title: '选择头像失败',
        icon: 'none'
      });
    }
  },

  // 添加取消授权方法
  cancelAuth() {
    this.setData({
      showPhoneAuth: false,
      tempUserInfo: null
    });
  },

  // 开始每日任务
  startDailyTask() {
    wx.navigateTo({
      url: '/packageExam/pages/random-practice/random-practice?mode=daily'
    });
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadDailyProgress(); // 刷新每日进度
    const authInfo = wx.getStorageSync('authInfo');
    if (authInfo && authInfo.isLogin && authInfo.userInfo) {
      this.loadUserData(authInfo.userInfo.phoneNumber, true);
    }

    // 检查暗黑模式
    const darkMode = wx.getStorageSync('darkMode') || false;
    if (this.data.darkMode !== darkMode) {
      this.setData({
        darkMode
      });
      this.updateNavigationBarColor();
    }

    this.loadCounts();
    this.loadTopThree();
    if (this.data.isLogin) {
      this.checkAvailableReward();
    }
  },

  loadCounts() {
    const wrongQuestions = wx.getStorageSync('wrongQuestions') || [];
    const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];

    this.setData({
      wrongCount: wrongQuestions.length,
      favoriteCount: favoriteQuestions.length
    });
  },

  goToWrongBook() {
    wx.navigateTo({
      url: '/pages/wrong/wrong'
    });
  },

  goToFavorites() {
    // 修改为正确的路径
    wx.navigateTo({
      url: '/pages/favorites-practice/favorites-practice',
      fail: (err) => {
        console.error('跳转收藏页面失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },

  goToRanking() {
    wx.navigateTo({
      url: '/pages/ranking/ranking'
    });
  },

  // 修改加载排行榜数据的方法
  async loadRankingData() {
    try {
      wx.showLoading({
        title: '加载中...'
      });

      const db = wx.cloud.database();
      const _ = db.command;

      // 获取所有有效用户
      const { data: users } = await db.collection('users')
        .where({
          totalQuestions: _.gt(1),
          correctQuestions: _.gt(0),
          phoneNumber: _.exists(true)
        })
        .orderBy('totalQuestions', 'desc')
        .limit(10)
        .field({
          nickName: true,
          phoneNumber: true,
          totalQuestions: true,
          correctQuestions: true
        })
        .get();

      // 处理用户数据
      const rankingList = users.map((user, index) => {
        // 使用默认头像
        const avatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';

        return {
          ...user,
          avatarUrl,
          nickName: user.nickName || '微信用户',
          correctRate: user.totalQuestions > 0 ?
            Math.round((user.correctQuestions / user.totalQuestions) * 100) : 0,
          ranking: index + 1  // 添加排名
        };
      });

      // 获取当前用户排名
      if (this.data.isLogin && this.data.userInfo?.phoneNumber) {
        const myRanking = rankingList.findIndex(user =>
          user.phoneNumber === this.data.userInfo.phoneNumber
        ) + 1;

        if (myRanking > 0) {
          const myStats = rankingList.find(user =>
            user.phoneNumber === this.data.userInfo.phoneNumber
          );

          this.setData({
            myRanking,
            myStats: {
              totalQuestions: myStats.totalQuestions || 0,
              correctRate: myStats.correctRate || '0%'
            }
          });
        }
      }

      this.setData({ rankingList });
      console.log('排行榜数据:', rankingList);

      wx.hideLoading();
    } catch (err) {
      console.error('加载排行榜数据失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败，请稍后重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 修改保存用户统计的方法
  async saveUserStats() {
    if (!this.data.isLogin) return;

    try {
      const db = wx.cloud.database();
      const totalAnswered = wx.getStorageSync('totalAnswered') || 0;
      const wrongQuestions = wx.getStorageSync('wrongQuestions') || [];
      const correctCount = totalAnswered - wrongQuestions.length;
      const correctRate = totalAnswered > 0
        ? Math.round((correctCount / totalAnswered) * 100)
        : 0;

      // 使用机号查找用户记录
      const { data } = await db.collection('users')
        .where({
          phoneNumber: this.data.userInfo.phoneNumber
        })
        .get();

      if (data.length > 0) {
        await db.collection('users').doc(data[0]._id).update({
          data: {
            totalQuestions: totalAnswered,
            correctQuestions: correctCount,
            wrongQuestions: wrongQuestions.length,
            correctRate: correctRate,
            updateTime: db.serverDate()
          }
        });
      }
    } catch (err) {
      console.error('保存用户计失败:', err);
    }
  },

  // 添加检查登录状态的方法
  async checkLoginStatus() {
    try {
      // 调用云函数获取 openId
      const { result } = await wx.cloud.callFunction({
        name: 'getOpenId'
      });

      if (!result.success) {
        throw new Error('获取用户ID失败');
      }

      const openId = result.openid;
      this.setData({ openId });

      // 查询用户是否已注册
      const db = wx.cloud.database();
      const { data } = await db.collection('users')
        .where({
          _openid: openId
        })
        .get();

      if (data.length > 0) {
        // 用户已注册，自动登录
        const userData = data[0];

        // 获取头像临时链接
        let avatarUrl = userData.avatarUrl;
        if (avatarUrl && avatarUrl.startsWith('cloud://')) {
          try {
            const { fileList } = await wx.cloud.getTempFileURL({
              fileList: [avatarUrl]
            });
            avatarUrl = fileList[0].tempFileURL;
          } catch (err) {
            console.error('获取头像链接失败:', err);
            avatarUrl = 'https://api.hsbogk.icu/weix/images/default-avatar.png';
          }
        }

        // 更新全局状态
        const app = getApp();
        app.globalData.isLogin = true;
        app.globalData.userInfo = {
          nickName: userData.nickName,
          avatarUrl: avatarUrl
        };

        // 更新页面状态
        this.setData({
          isLogin: true,
          userInfo: {
            nickName: userData.nickName,
            avatarUrl: avatarUrl
          },
          signDays: userData.signDays || 0,
          totalQuestions: userData.totalQuestions || 0,
          correctRate: userData.correctRate || 0
        });
      }
    } catch (err) {
      console.error('检查登录状态失败:', err);
    }
  },

  // 添加自动登录方法
  async autoLogin(phoneNumber) {
    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('users')
        .where({
          phoneNumber: phoneNumber
        })
        .get();

      if (data.length > 0) {
        const userData = data[0];

        // 获取头像临时链接
        let avatarUrl = userData.avatarUrl;
        if (avatarUrl && avatarUrl.startsWith('cloud://')) {
          try {
            const { fileList } = await wx.cloud.getTempFileURL({
              fileList: [avatarUrl]
            });
            avatarUrl = fileList[0].tempFileURL;
          } catch (err) {
            console.error('获取头像接失败:', err);
            avatarUrl = 'https://api.hsbogk.icu/weix/images/default-avatar.png';
          }
        }

        // 更新全局状态
        const app = getApp();
        app.globalData.isLogin = true;
        app.globalData.userInfo = {
          nickName: userData.nickName,
          avatarUrl: avatarUrl,
          phoneNumber: phoneNumber
        };

        // 更新页面状态
        this.setData({
          isLogin: true,
          userInfo: {
            nickName: userData.nickName,
            avatarUrl: avatarUrl,
            phoneNumber: phoneNumber
          },
          signDays: userData.signDays || 0,
          totalQuestions: userData.totalQuestions || 0,
          correctRate: userData.correctRate || 0
        });

        return true;
      }
      return false;
    } catch (err) {
      console.error('自动登录失败:', err);
      return false;
    }
  },

  // 修改开始每日练习的方法
  startDailyPractice() {
    console.log('点击开始答题按钮');
    console.log('当前完成题数:', this.data.completedCount);

    // 先检查是否登录
    if (!this.data.isLogin) {
      console.log('用户未登录，显示登录弹窗');
      this.showLoginModal();
      return;
    }

    // 检查是否完成每日目标
    if (this.data.completedCount >= 20) {
      console.log('今日已完成');
      wx.showToast({
        title: '今日已完成',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    console.log('准备跳转到答题页面');
    wx.navigateTo({
      url: '/pages/points-practice/points-practice',
      success: () => {
        console.log('跳转成功');
      },
      fail: (err) => {
        console.error('跳转失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 加载每日进度
  async loadDailyProgress() {
    try {
      if (!this.data.isLogin || !this.data.userInfo) {
        console.log('用户未登录，不加载每日进度');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      console.log('当前日期:', today);

      const db = wx.cloud.database();
      const _ = db.command;

      // 查询今日的答题记录
      const { data: records } = await db.collection('dailyPoints')
        .where({
          phoneNumber: this.data.userInfo.phoneNumber,
          date: _.gte(today),
          type: 'daily_practice'
        })
        .get();

      console.log('查询到的每日记录:', records);

      if (records.length === 0) {
        // 今天还没有记录
        this.setData({
          completedCount: 0
        });
        console.log('今天还没有答题记录');
      } else {
        // 使用今天已有的记录
        const record = records[0];
        this.setData({
          completedCount: record.completedCount || 0
        });
        console.log('更新每日进度:', record.completedCount);
      }

      // 检查是否已完成每日目标
      if (this.data.completedCount >= 20) {
        console.log('今日已完成目标');
        this.setData({
          'userInfo.completedToday': true
        });
      }

    } catch (err) {
      console.error('加载每日进度失败:', err);
      // 如果云数据库操作失败，尝试使用本地存储作为备份
      const dailyProgress = wx.getStorageSync('dailyProgress') || {};
      const today = new Date().toDateString();

      if (dailyProgress.date !== today) {
        const newProgress = {
          date: today,
          completedCount: 0,
          points: 0
        };
        wx.setStorageSync('dailyProgress', newProgress);
        this.setData({
          completedCount: 0
        });
      } else {
        this.setData({
          completedCount: dailyProgress.completedCount || 0
        });
      }
    }
  },

  // 更新每日进度
  async updateDailyProgress(completedCount, points) {
    try {
      if (!this.data.isLogin || !this.data.userInfo) {
        console.log('用户未登录，不更新每日进度');
        return;
      }

      const db = wx.cloud.database();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 查询今日记录
      const { data: records } = await db.collection('dailyRecords')
        .where({
          phoneNumber: this.data.userInfo.phoneNumber,
          date: db.command.gte(today)
        })
        .get();

      if (records.length > 0) {
        // 更新现有记录
        const record = records[0];
        await db.collection('dailyRecords').doc(record._id).update({
          data: {
            completedCount: completedCount,
            points: points,
            lastUpdateTime: db.serverDate()
          }
        });
      } else {
        // 创建新记录
        await db.collection('dailyRecords').add({
          data: {
            phoneNumber: this.data.userInfo.phoneNumber,
            date: db.serverDate(),
            completedCount: completedCount,
            points: points,
            lastUpdateTime: db.serverDate()
          }
        });
      }

      // 更新本地显示
      this.setData({
        completedCount: completedCount
      });

      console.log('每日进度已更新 - 完成题数:', completedCount, '积分:', points);

    } catch (err) {
      console.error('更新每日进度失败:', err);
      // 如果云数据库操作失败，更新本地存储作为备份
      const dailyProgress = {
        date: new Date().toDateString(),
        completedCount: completedCount,
        points: points
      };
      wx.setStorageSync('dailyProgress', dailyProgress);
    }
  },

  // 添加自动刷新积分的方法
  async refreshUserPoints() {
    try {
      if (!this.data.userInfo?.phoneNumber) return;

      const db = wx.cloud.database();
      const { data } = await db.collection('users')
        .where({
          phoneNumber: this.data.userInfo.phoneNumber
        })
        .field({
          points: true,
          signDays: true
        })
        .get();

      if (data.length > 0) {
        const points = data[0].points || 0;
        const signDays = data[0].signDays || 0;

        this.setData({
          points,
          signDays,
          'userInfo.points': points,
          'userInfo.signDays': signDays
        });

        console.log('积分和天数已刷新 - 积分:', points, '天数:', signDays);
      }
    } catch (err) {
      console.error('刷新积分和天数失败:', err);
    }
  },

  // 显示查用户名弹窗
  findUsername() {
    this.setData({
      showFindUsername: true,
      findPhoneNumber: '',
      foundUsername: ''
    });
  },

  // 隐藏查找用户名弹窗
  hideFindUsername() {
    this.setData({
      showFindUsername: false,
      findPhoneNumber: '',
      foundUsername: ''
    });
  },

  // 处理查手机号输入
  handleFindPhoneInput(e) {
    const phoneNumber = e.detail.value.replace(/\D/g, '').slice(0, 11);
    this.setData({
      findPhoneNumber: phoneNumber
    });
  },

  // 查找用户名
  async searchUsername() {
    try {
      const { findPhoneNumber } = this.data;

      if (!findPhoneNumber || !/^1[3-9]\d{9}$/.test(findPhoneNumber)) {
        wx.showToast({
          title: '请输入正确的手机号',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '查找中...',
        mask: true
      });

      const db = wx.cloud.database();
      const { data: users } = await db.collection('users')
        .where({ phoneNumber: findPhoneNumber })
        .get();

      wx.hideLoading();

      if (users.length === 0) {
        wx.showToast({
          title: '未找到该手机号绑定的账号',
          icon: 'none'
        });
        return;
      }

      this.setData({
        foundUsername: users[0].nickName
      });

    } catch (err) {
      console.error('查找用户名失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '查找失败',
        icon: 'none'
      });
    }
  },

  // 修改加载前三名的方法
  async loadTopThree() {
    try {
      const db = wx.cloud.database();
      const _ = db.command;

      const { data: topUsers } = await db.collection('users')
        .where({
          points: _.exists(true).and(_.gt(0)),
          phoneNumber: _.exists(true)
        })
        .orderBy('points', 'desc')
        .limit(3)
        .field({
          nickName: true,
          phoneNumber: true,
          points: true,
          totalQuestions: true,
          correctQuestions: true
        })
        .get();

      // 处理用户数据
      const formattedTopUsers = topUsers.map((user, index) => {
        // 根据排名设置固定的奖牌图片
        let avatarUrl;
        if (index === 0) {
          avatarUrl = this.data.iconBaseUrl + '/@1.gif';
        } else if (index === 1) {
          avatarUrl = this.data.iconBaseUrl + '/@2.png';
        } else if (index === 2) {
          avatarUrl = this.data.iconBaseUrl + '/@3.png';
        }

        // 计算正确率
        const correctRate = user.totalQuestions > 0
          ? Math.round((user.correctQuestions / user.totalQuestions) * 100)
          : 0;

        // 计算段位
        let tier = '';
        let tierClass = '';
        const points = user.points || 0;

        if (points >= 5000) {
          tier = '至尊';
          tierClass = 'tier-supreme';
        } else if (points >= 3600) {
          tier = '王者';
          tierClass = 'tier-king';
        } else if (points >= 3000) {
          tier = '大师';
          tierClass = 'tier-master';
        } else if (points >= 2400) {
          tier = '钻石';
          tierClass = 'tier-diamond';
        } else if (points >= 1800) {
          tier = '铂金';
          tierClass = 'tier-platinum';
        } else if (points >= 1200) {
          tier = '黄金';
          tierClass = 'tier-gold';
        } else if (points >= 600) {
          tier = '白银';
          tierClass = 'tier-silver';
        } else {
          tier = '青铜';
          tierClass = 'tier-bronze';
        }

        return {
          ...user,
          avatarUrl,
          nickName: user.nickName || '微信用户',
          points: points,
          tier: tier,
          tierClass: tierClass,
          correctRate: correctRate,
          ranking: index + 1
        };
      });

      this.setData({
        topUsers: formattedTopUsers
      });

    } catch (err) {
      console.error('加载前三名失败:', err);
    }
  },

  // 修改加载重置次数的方法
  async loadResetCount() {
    try {
      const phoneNumber = this.data.userInfo?.phoneNumber;
      if (!phoneNumber) return;

      // 检查是否是管理员
      const isAdmin = this.checkAdminStatus(phoneNumber);

      if (isAdmin) {
        this.setData({
          resetCount: 0,
          maxResetTimes: 999999 // 管理员设置一个很大的数字
        });
        return;
      }

      const db = wx.cloud.database();
      const { data } = await db.collection('users')
        .where({
          phoneNumber: phoneNumber
        })
        .get();

      if (data.length > 0) {
        this.setData({
          resetCount: data[0].resetCount || 0
        });
      }
    } catch (err) {
      console.error('加载重置次数失败:', err);
    }
  },

  // 重置所有数据
  async resetAllData() {
    if (this.data.showAccountModal) {
      this.hideAccountManagement();
    }
    const authInfo = wx.getStorageSync('authInfo');
    const isAdmin = authInfo?.userInfo?.isAdmin || false;
    const isSecondAdmin = authInfo?.userInfo?.isSecondAdmin || false;

    // 只对非管理员进行重置次数限制
    if (!isAdmin && !isSecondAdmin) {
      if (this.data.resetCount >= this.data.maxResetTimes) {
        wx.showToast({
          title: '已达到最大重置次数',
          icon: 'none'
        });
        return;
      }
    }

    const that = this;
    wx.showModal({
      title: '确认重置',
      content: isAdmin || isSecondAdmin ?
        '管理员重置不受次数限制。重置将清空所有数据，包括积分、排名、答题记录、签到天数、顺序刷题进度等，且无法恢复，是否继续？' :
        `重置将清空所有数据，包括积分、排名、答题记录、签到天数、顺序刷题进度等，且无法恢复。\n剩余重置次数：${this.data.maxResetTimes - this.data.resetCount}次\n是否继续？`,
      confirmText: '确认重置',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '正在重置...',
            mask: true
          });

          try {
            const db = wx.cloud.database();
            const _ = db.command;
            const phoneNumber = authInfo?.userInfo?.phoneNumber;

            if (!phoneNumber) {
              throw new Error('未登录');
            }

            // 1. 记录重置操作
            await db.collection('resetRecords').add({
              data: {
                phoneNumber: phoneNumber,
                resetTime: db.serverDate(),
                beforePoints: that.data.points || 0,
                beforeTier: that.data.userInfo?.tier || '青铜',
                beforeTotalQuestions: that.data.userInfo?.totalQuestions || 0,
                beforeCorrectQuestions: that.data.userInfo?.correctQuestions || 0,
                beforeWrongQuestions: that.data.userInfo?.wrongQuestions || 0,
                resetCount: (that.data.resetCount || 0) + 1,
                isAdmin: isAdmin || isSecondAdmin,
                platform: 'win32',
                systemInfo: wx.getSystemInfoSync(),
                adminReset: isAdmin || isSecondAdmin
              }
            });

            // 2. 定义要重置的集合列表
            const collections = [
              { name: 'user_wrong_questions', field: 'phoneNumber' },
              { name: 'user_favorite_questions', field: 'phoneNumber' },
              { name: 'user_breakthrough', field: 'phoneNumber' },
              { name: 'battle_records', field: 'phoneNumber' },
              { name: 'breakthrough_records', field: 'phoneNumber' },
              { name: 'user_experience', field: 'phoneNumber' },
              { name: 'dailyTasks', field: 'phoneNumber' },
              { name: 'dailyRecords', field: 'phoneNumber' },
              { name: 'completedPapers', field: 'phone' },
              { name: 'signInRecords', field: 'phoneNumber' },
              { name: 'dailyPoints', field: 'phoneNumber' }
            ];

            // 3. 批量删除各集合中的用户数据
            const deletePromises = collections.map(collection => {
              return db.collection(collection.name)
                .where({
                  [collection.field]: phoneNumber
                })
                .remove()
                .catch(err => {
                  console.log(`删除${collection.name}集合数据失败:`, err);
                  return null; // 返回null而不是中断
                });
            });

            await Promise.all(deletePromises);

            // 4. 重置users表中的数据
            const updateData = {
              points: 0,
              totalQuestions: 0,
              correctQuestions: 0,
              wrongQuestions: 0,
              correctRate: 0,
              lastAnswerTime: null,
              wrongCount: 0,
              favoriteCount: 0,
              lastResetTime: db.serverDate(),
              signInDays: 0,
              consecutiveDays: 0,
              lastSignInDate: null
            };

            // 只有非管理员才增加重置次数
            if (!isAdmin && !isSecondAdmin) {
              updateData.resetCount = _.inc(1);
            }

            await db.collection('users').where({
              phoneNumber: phoneNumber
            }).update({
              data: updateData
            });

            // 5. 清除本地缓存
            const cacheKeys = [
              'completedPapersCache',
              'userStats',
              'dailyProgress',
              'lastAnswerTime',
              'practiceProgress',
              'lastPracticeTime',
              'practiceHistory',
              'wrongQuestions',
              'favorites',
              'wrongQuestionsCache',
              'favoritesCache',
              'signInData',
              'lastSignInDate',
              'consecutiveSignIn',
              'signInStats',
              'todaySignIn'
            ];

            cacheKeys.forEach(key => {
              try {
                wx.removeStorageSync(key);
              } catch (err) {
                console.log(`清除缓存${key}失败:`, err);
              }
            });

            // 6. 更新页面数据
            const newData = {
              points: 0,
              wrongCount: 0,
              favoriteCount: 0,
              myRanking: '-',
              'userInfo.points': 0,
              'userInfo.tier': '青铜',
              'userInfo.tierClass': 'tier-bronze',
              tierProgress: '0.0',
              nextTierText: '距离白银还需600分',
              signInDays: 0,
              consecutiveDays: 0,
              todaySigned: false
            };

            // 只有非管理员才更新重置次数
            if (!isAdmin && !isSecondAdmin) {
              newData.resetCount = (that.data.resetCount || 0) + 1;
            }

            that.setData(newData);

            // 7. 刷新页面数据
            await that.loadUserData(phoneNumber, true);

            // 8. 通知其他页面刷新
            const pages = getCurrentPages();
            pages.forEach(page => {
              if (page.route.includes('practice/practice')) {
                page.loadCompletedPapers && page.loadCompletedPapers();
                page.setData && page.setData({
                  completedPapers: [],
                  completedCount: 0,
                  remainingCount: page.data.examPapers ? page.data.examPapers.length : 0,
                  firstUncompletedIndex: 0
                });
              }
            });

            wx.hideLoading();
            wx.showToast({
              title: '重置成功',
              icon: 'success',
              duration: 2000,
              success: () => {
                setTimeout(() => {
                  wx.reLaunch({
                    url: '/pages/comprehensive/comprehensive'
                  });
                }, 2000);
              }
            });
          } catch (error) {
            console.error('重置失败:', error);
            wx.hideLoading();
            wx.showToast({
              title: '重置失败，请重试',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },

  // 修改 updateUserStats 方法
  async updateUserStats(correctCount, wrongCount, points, isPassed) {
    try {
      const app = getApp();
      if (!app.globalData.isLogin) return;

      const db = wx.cloud.database();
      const _ = db.command;

      // 获取今日日期
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 获取用户信息
      const { data: users } = await db.collection('users')
        .where({
          phoneNumber: app.globalData.userInfo.phoneNumber
        })
        .get();

      if (users.length > 0) {
        const user = users[0];
        const currentPoints = user.points || 0;
        const newPoints = currentPoints + points;
        const newSignDays = Math.floor(newPoints / 30); // 根据新的总积分计算天数

        try {
          // 更新用户统计数据
          await db.collection('users').doc(user._id).update({
            data: {
              totalQuestions: _.inc(20),
              correctQuestions: _.inc(correctCount),
              wrongQuestions: _.inc(wrongCount),
              points: newPoints,
              correctRate: Math.round((correctCount / 20) * 100),
              lastAnswerTime: db.serverDate(),
              signDays: newSignDays // 使用新计算的天数
            }
          });

          // 立即重新加载用户数据(强制刷新)
          await this.loadUserData(app.globalData.userInfo.phoneNumber, true);

          // 更新本地显示
          this.setData({
            signDays: newSignDays,
            points: newPoints
          });

          if (points > 0) {
            wx.showToast({
              title: `获得${points}积分！已累计${newSignDays}天`,
              icon: 'success'
            });
          }
        } catch (err) {
          console.error('更新用户数据失败:', err);
        }
      }
    } catch (err) {
      console.error('更新用户统计失败:', err);
      wx.showToast({
        title: '更新统计失败',
        icon: 'none'
      });
    }
  },

  onPageShow() {
    // 每次页面显示时强制刷新数据
    const authInfo = wx.getStorageSync('authInfo');
    if (authInfo && authInfo.isLogin && authInfo.userInfo) {
      this.loadUserData(authInfo.userInfo.phoneNumber, true);
    }
  },

  onTabItemTap() {
    // 点击 tab 时也刷新数据
    this.onPageShow();
  },

  // 添加从本地获取错题本和收藏数量的方法
  loadLocalCounts() {
    // 获取错题本数量
    const wrongQuestions = wx.getStorageSync('wrongQuestions') || [];
    // 获取收藏题目数量
    const favoriteQuestions = wx.getStorageSync('favoriteQuestions') || [];

    this.setData({
      wrongCount: wrongQuestions.length,
      favoriteCount: favoriteQuestions.length
    });
  },

  // 获取前三名用户数据
  async loadTopUsers() {
    try {
      const db = wx.cloud.database();
      const _ = db.command;

      // 获取前三名用户
      const { data: topUsers } = await db.collection('users')
        .where({
          totalQuestions: _.gt(1),
          correctQuestions: _.gt(0),
          phoneNumber: _.exists(true)
        })
        .orderBy('totalQuestions', 'desc')
        .limit(3)
        .field({
          nickName: true,
          phoneNumber: true,
          totalQuestions: true,
          correctQuestions: true
        })
        .get();

      console.log('前三名用户数据:', topUsers);

      // 处理用户数据
      const processedUsers = topUsers.map((user, index) => {
        // 根据排名设置固定的奖牌图片
        let avatarUrl;
        if (index === 0) {
          avatarUrl = this.data.iconBaseUrl + '/@1.gif';
        } else if (index === 1) {
          avatarUrl = this.data.iconBaseUrl + '/@2.png';
        } else if (index === 2) {
          avatarUrl = this.data.iconBaseUrl + '/@3.png';
        }

        return {
          ...user,
          nickName: user.nickName || '微信用户',
          avatarUrl: avatarUrl,
          correctRate: user.totalQuestions > 0 ?
            Math.round((user.correctQuestions / user.totalQuestions) * 100) : 0
        };
      });

      this.setData({
        topUsers: processedUsers
      });
    } catch (err) {
      console.error('获取前三名用户数据失败:', err);
    }
  },

  // 手机号登录成功后的处理
  handlePhoneLoginSuccess(phoneNumber, userInfo) {
    const app = getApp();

    // 更新全局状态
    app.globalData.isLogin = true;
    app.globalData.phoneNumber = phoneNumber;
    app.globalData.userInfo = userInfo;

    // 保存到本地存储
    wx.setStorageSync('phoneNumber', phoneNumber);
    wx.setStorageSync('userInfo', userInfo);

    // 更新页面状态
    this.setData({
      isLogin: true,
      userInfo: userInfo
    });

    wx.showToast({
      title: '登录成功',
      icon: 'success'
    });
  },

  // 显示规则弹窗
  showRules() {
    this.setData({
      showRulesModal: true
    });
  },

  // 隐藏规则弹窗
  hideRules() {
    this.setData({
      showRulesModal: false
    });
  },

  // 阻止冒泡
  stopPropagation(e) {
    return;
  },

  // 更新导航栏颜色
  updateNavigationBarColor() {
    wx.setNavigationBarColor({
      frontColor: this.data.darkMode ? '#ffffff' : '#000000',
      backgroundColor: this.data.darkMode ? '#1f1f1f' : '#ffffff',
      animation: {
        duration: 300,
        timingFunc: 'easeIn'
      }
    });
  },

  showLogoutConfirm() {
    this.setData({
      showLogoutConfirm: true,
      logoutConfirmText: ''
    });
  },

  hideLogoutConfirm() {
    this.setData({
      showLogoutConfirm: false,
      logoutConfirmText: ''
    });
  },

  handleLogoutConfirmInput(e) {
    this.setData({
      logoutConfirmText: e.detail.value
    });
  },

  async executeLogout() {
    if (this.data.logoutConfirmText !== '确认注销') {
      return;
    }

    wx.showLoading({
      title: '注销中...',
      mask: true
    });

    try {
      const app = getApp();
      const db = wx.cloud.database();
      const userInfo = wx.getStorageSync('userInfo');
      
      if (!userInfo || !userInfo.phoneNumber) {
        throw new Error('用户信息不完整');
      }

      // 删除用户数据
      await db.collection('users').where({
        phoneNumber: userInfo.phoneNumber
      }).remove();

      // 删除用户统计数据
      await db.collection('userStats').where({
        phoneNumber: userInfo.phoneNumber
      }).remove();

      // 删除用户错题记录
      await db.collection('wrongQuestions').where({
        phoneNumber: userInfo.phoneNumber
      }).remove();

      // 删除用户收藏记录
      await db.collection('favorites').where({
        phoneNumber: userInfo.phoneNumber
      }).remove();

      // 清除本地存储
      wx.clearStorageSync();

      // 重置全局状态
      app.globalData.isLogin = false;
      app.globalData.userInfo = null;

      wx.hideLoading();

      wx.showToast({
        title: '账号已注销',
        icon: 'success',
        duration: 2000,
        success: () => {
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/index/index'
            });
          }, 2000);
        }
      });
    } catch (error) {
      console.error('注销账号失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '注销失败，请重试',
        icon: 'none'
      });
    }
  },

  // 显示编辑资料弹窗
  showEditProfile() {
    this.setData({
      showEditModal: true,
      tempUserInfo: {
        nickName: this.data.userInfo.nickName,  // 使用当前用户名
        avatarUrl: this.data.userInfo.avatarUrl
      }
    });
  },

  // 隐藏编辑资料弹窗
  hideEditProfile() {
    this.setData({
      showEditModal: false
    });
  },

  // 输入用户名
  onNicknameInput(e) {
    const value = e.detail.value;
    // 只保留中文字符
    const chineseValue = value.replace(/[^\u4e00-\u9fa5]/g, '');
    this.setData({
      'tempUserInfo.nickName': chineseValue
    });
  },

  // 保存资料
  async saveProfile() {
    try {
      const { nickName, avatarUrl } = this.data.tempUserInfo;
      const updateData = {};
      let needUpdate = false;

      // 只有当用户输入了新的用户名且与当前用户名不同时才验证和更新
      if (nickName && nickName !== this.data.userInfo.nickName) {
        // 验证用户名
        if (nickName.length < 2 || nickName.length > 12) {
          wx.showToast({
            title: '用户名长度应在2-12个字符之间',
            icon: 'none'
          });
          return;
        }

        // 检查用户名是否包含敏感词
        const nameCheck = isValidUsername(nickName);
        if (!nameCheck.valid) {
          wx.showToast({
            title: nameCheck.message,
            icon: 'none'
          });
          return;
        }

        updateData.nickName = nickName;
        needUpdate = true;
      }

      // 检查头像是否有更新
      if (avatarUrl && avatarUrl !== this.data.userInfo.avatarUrl) {
        updateData.avatarUrl = avatarUrl;
        needUpdate = true;
      }

      // 如果没有任何更新，直接关闭弹窗
      if (!needUpdate) {
        this.setData({
          showEditModal: false
        });
        return;
      }

      wx.showLoading({ title: '保存中...' });

      const db = wx.cloud.database();
      updateData.updateTime = db.serverDate();

      await db.collection('users').doc(this.data.userInfo._id).update({
        data: updateData
      });

      // 更新本地数据
      const newUserInfo = {
        ...this.data.userInfo
      };
      if (updateData.nickName) {
        newUserInfo.nickName = updateData.nickName;
      }
      if (updateData.avatarUrl) {
        newUserInfo.avatarUrl = updateData.avatarUrl;
      }

      this.setData({
        userInfo: newUserInfo,
        showEditModal: false
      });

      // 更新全局数据
      const app = getApp();
      if (app.globalData.userInfo) {
        app.globalData.userInfo = {
          ...app.globalData.userInfo,
          ...updateData
        };
      }

      // 更新本地存储
      const authInfo = wx.getStorageSync('authInfo');
      if (authInfo) {
        authInfo.userInfo = {
          ...authInfo.userInfo,
          ...updateData
        };
        wx.setStorageSync('authInfo', authInfo);
      }

      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

    } catch (err) {
      console.error('保存资料失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  // 清理本地缓存
  clearCache() {
    if (this.data.showAccountModal) {
      this.hideAccountManagement();
    }
    wx.showModal({
      title: '确认清理',
      content: '确定要清理本地缓存吗？清理后需要重新登录。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '正在清理...',
            mask: true
          });

          try {
            // 清理本地缓存
            wx.clearStorageSync();

            // 重置全局数据
            const app = getApp();
            app.globalData.isLogin = false;
            app.globalData.userInfo = null;

            wx.showToast({
              title: '清理成功',
              icon: 'success',
              duration: 2000,
              complete: () => {
                // 延迟1秒后重启小程序
                setTimeout(() => {
                  wx.reLaunch({
                    url: '/pages/comprehensive/comprehensive'
                  });
                }, 1000);
              }
            });
          } catch (e) {
            console.error('清理缓存失败:', e);
            wx.showToast({
              title: '清理失败',
              icon: 'error'
            });
          }
        }
      }
    });
  },

  // 显示签到日历弹窗
  showSignInCalendar() {
    this.setData({
      showCalendar: true
    });
    // 生成日历数据
    this.generateCalendarDays();
    // 加载签到数据
    this.loadSignInData();
  },

  // 隐藏签到日历弹窗
  hideSignInCalendar() {
    this.setData({
      showCalendar: false
    });
  },

  // 生成日历数据
  generateCalendarDays() {
    const { currentYear, currentMonth } = this.data;
    const days = [];

    // 获取当月第一天是星期几
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    // 获取当月天数
    const monthDays = new Date(currentYear, currentMonth, 0).getDate();

    // 填充上个月的日期
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        date: `${currentYear}-${currentMonth - 1}-${prevMonthDays - i}`
      });
    }

    // 填充当月日期
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth;
    for (let i = 1; i <= monthDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        isToday: isCurrentMonth && today.getDate() === i,
        date: `${currentYear}-${currentMonth}-${i}`
      });
    }

    // 填充下个月的日期
    const remainingDays = 42 - days.length; // 保持6行
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: `${currentYear}-${currentMonth + 1}-${i}`
      });
    }

    this.setData({
      calendarDays: days
    });
  },

  // 加载签到数据
  async loadSignInData() {
    try {
      const db = wx.cloud.database();

      // 从users表中获取签到数据
      const { data: users } = await db.collection('users')
        .where({
          phoneNumber: this.data.userInfo.phoneNumber
        })
        .get();

      if (users.length > 0) {
        const user = users[0];

        // 获取本月的签到记录
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: records } = await db.collection('signInRecords')
          .where({
            phoneNumber: user.phoneNumber,
            signInDate: db.command.gte(startOfMonth)
          })
          .get();

        // 更新日历上的签到标记
        const calendarDays = this.data.calendarDays.map(day => {
          const dayDate = new Date(day.date);
          const isSigned = records.some(record => {
            const recordDate = new Date(record.signInDate);
            return recordDate.toDateString() === dayDate.toDateString();
          });

          return {
            ...day,
            isSigned
          };
        });

        this.setData({
          signInDays: user.signInDays || 0,
          consecutiveDays: user.consecutiveDays || 0,
          todaySigned: user.lastSignInDate ?
            new Date(user.lastSignInDate).toDateString() === new Date().toDateString() : false,
          calendarDays
        });
      }
    } catch (err) {
      console.error('加载签到数据失败:', err);
      wx.showToast({
        title: '加载签到数据失败',
        icon: 'none'
      });
    }
  },

  // 处理签到操作
  async handleSignIn() {
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 签到奖励积分
      const SIGN_IN_POINTS = 5;

      // 获取用户数据
      const { data: users } = await db.collection('users')
        .where({
          phoneNumber: this.data.userInfo.phoneNumber
        })
        .get();

      if (users.length === 0) {
        wx.showToast({
          title: '用户数据不存在',
          icon: 'none'
        });
        return;
      }

      const user = users[0];
      const lastSignInDate = user.lastSignInDate ? new Date(user.lastSignInDate) : null;

      // 检查是否已经签到
      if (lastSignInDate && lastSignInDate.toDateString() === today.toDateString()) {
        wx.showToast({
          title: '今天已经签到过了',
          icon: 'none'
        });
        return;
      }

      // 计算连续签到天数
      let newConsecutiveDays = 1;
      if (lastSignInDate) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastSignInDate.toDateString() === yesterday.toDateString()) {
          newConsecutiveDays = (user.consecutiveDays || 0) + 1;
        }
      }

      // 计算签到奖励积分（连续签到有额外奖励）
      let bonusPoints = 0;
      if (newConsecutiveDays >= 7) {
        bonusPoints = 5; // 连续7天及以上额外奖励5分
      } else if (newConsecutiveDays >= 3) {
        bonusPoints = 3; // 连续3天额外奖励3分
      }

      const totalPoints = SIGN_IN_POINTS + bonusPoints;

      // 更新用户数据
      await db.collection('users').doc(user._id).update({
        data: {
          points: _.inc(totalPoints),
          signInDays: _.inc(1),
          consecutiveDays: newConsecutiveDays,
          lastSignInDate: db.serverDate()
        }
      });

      // 添加签到记录
      await db.collection('signInRecords').add({
        data: {
          phoneNumber: user.phoneNumber,
          signInDate: db.serverDate(),
          points: totalPoints,
          consecutiveDays: newConsecutiveDays
        }
      });

      // 更新页面数据
      this.setData({
        points: (user.points || 0) + totalPoints,
        signInDays: (user.signInDays || 0) + 1,
        consecutiveDays: newConsecutiveDays,
        todaySigned: true
      });

      // 显示签到成功提示
      let toastText = `签到成功 +${SIGN_IN_POINTS}积分`;
      if (bonusPoints > 0) {
        toastText += `\n连续签到奖励 +${bonusPoints}积分`;
      }

      wx.showToast({
        title: toastText,
        icon: 'none',
        duration: 2000
      });

      // 刷新用户数据
      await this.loadUserData(user.phoneNumber, true);

    } catch (err) {
      console.error('签到失败:', err);
      wx.showToast({
        title: '签到失败，请重试',
        icon: 'none'
      });
    }
  },

  // 检查是否满足领取条件
  checkCollectConditions(reward) {
    const user = this.data.userInfo;
    if (!user) return false;

    // 如果没有任何条件限制，则可以领取
    if (!reward.minQuestions && !reward.minCorrectRate && !reward.minRanking) {
      return true;
    }

    // 计算正确率
    const correctRate = user.totalQuestions > 0
      ? ((user.correctQuestions / user.totalQuestions) * 100).toFixed(2)
      : 0;

    if (reward.minQuestions && user.totalQuestions < reward.minQuestions) {
      return false;
    }

    if (reward.minCorrectRate && correctRate < reward.minCorrectRate) {
      return false;
    }

    if (reward.minRanking && (!this.data.myRanking || this.data.myRanking > reward.minRanking)) {
      return false;
    }

    return true;
  },

  // 获取用户统计数据
  async getUserStats() {
    try {
      const { data } = await wx.cloud.database().collection('users')
        .where({
          _openid: this.data.openid
        })
        .get();

      if (data && data[0]) {
        const user = data[0];
        this.setData({
          userStats: {
            totalQuestions: user.totalQuestions || 0,
            correctQuestions: user.correctQuestions || 0,
            correctRate: user.totalQuestions > 0
              ? ((user.correctQuestions / user.totalQuestions) * 100).toFixed(2)
              : 0
          }
        });
      }
    } catch (err) {
      console.error('获取用户统计数据失败：', err);
    }
  },

  // 显示奖励弹窗
  async showRewardModal() {
    await this.checkAvailableReward();
    this.setData({
      showRewardModal: true
    });
  },

  // 隐藏奖励弹窗
  hideRewardModal() {
    this.setData({
      showRewardModal: false
    });
  },

  // 检查可领取的奖励
  async checkAvailableReward() {
    if (!this.data.userInfo) return;

    try {
      const db = wx.cloud.database();

      // 获取已领取的奖励记录
      const { data: history } = await db.collection('reward_records')
        .where({
          userId: this.data.userInfo._id
        })
        .get();

      // 从reward_settings获取有效的奖励列表
      const { data: rewards } = await db.collection('reward_settings')
        .where({
          status: 'active'  // 只获取激活状态的奖励
        })
        .orderBy('createTime', 'desc')
        .get();

      if (!rewards || rewards.length === 0) {
        this.setData({ availableRewards: [] });
        return;
      }

      // 检查每个奖励的领取条件
      const availableRewards = rewards.map(reward => {
        // 先检查是否已领取
        const collected = history.some(h => h.rewardId === reward._id);
        return {
          ...reward,
          collected: collected,
          canCollect: !collected && this.checkCollectConditions(reward)
        };
      });

      this.setData({ availableRewards });
    } catch (error) {
      console.error('检查奖励失败:', error);
      wx.showToast({
        title: '获取奖励信息失败',
        icon: 'none'
      });
    }

    this.checkUnCollectedRewards(); // 添加这一行
  },

  // 检查是否有未领取的奖励
  checkUnCollectedRewards() {
    if (!this.data.availableRewards) {
      this.setData({
        hasUnCollectedRewards: false
      });
      return;
    }

    // 修改判断逻辑：只有当奖励可以领取时才显示红点
    const hasCollectableRewards = this.data.availableRewards.some(item => item.canCollect);
    this.setData({
      hasUnCollectedRewards: hasCollectableRewards
    });
  },

  // 领取奖励
  async collectReward(e) {
    const reward = e.currentTarget.dataset.reward;
    if (!reward || !reward.canCollect || this.data.isCollecting) return;

    try {
      this.setData({ isCollecting: true });

      // 再次验证条件
      if (!this.checkCollectConditions(reward)) {
        wx.showToast({
          title: '条件不满足',
          icon: 'none'
        });
        return;
      }

      const db = wx.cloud.database();

      // 检查奖励是否仍然有效
      const { data: rewardInfo } = await db.collection('reward_settings')
        .doc(reward._id)
        .get();

      if (!rewardInfo || rewardInfo.status !== 'active') {
        wx.showToast({
          title: '奖励已失效',
          icon: 'none'
        });
        await this.checkAvailableReward();
        return;
      }

      // 检查是否已领取
      const { data: existingRecord } = await db.collection('reward_records')
        .where({
          userId: this.data.userInfo._id,
          rewardId: reward._id
        })
        .get();

      if (existingRecord && existingRecord.length > 0) {
        wx.showToast({
          title: '该奖励已领取',
          icon: 'none'
        });
        return;
      }

      // 记录领取历史
      await db.collection('reward_records').add({
        data: {
          rewardId: reward._id,
          rewardName: reward.name,
          points: reward.points,
          collectTime: db.serverDate(),
          userId: this.data.userInfo._id,
          userInfo: {
            nickName: this.data.userInfo.nickName,
            avatarUrl: this.data.userInfo.avatarUrl
          }
        }
      });

      // 更新奖励的领取人数
      await db.collection('reward_settings').doc(reward._id).update({
        data: {
          userCount: db.command.inc(1)
        }
      });

      // 更新用户积分
      const newPoints = this.data.userInfo.points + reward.points;
      await db.collection('users').doc(this.data.userInfo._id).update({
        data: {
          points: newPoints
        }
      });

      // 更新本地显示
      this.setData({
        'userInfo.points': newPoints,
        points: newPoints
      });

      // 更新段位信息
      const { tierProgress, nextTierText } = this.calculateTierProgress(newPoints);
      this.setData({
        tierProgress,
        nextTierText
      });

      // 标记奖励为已领取
      const availableRewards = this.data.availableRewards.map(item => {
        if (item._id === reward._id) {
          item.canCollect = false;
        }
        return item;
      });
      this.setData({ availableRewards });

      wx.showToast({
        title: '领取成功',
        icon: 'success'
      });

    } catch (error) {
      console.error('领取奖励出错:', error);
      wx.showToast({
        title: '领取失败,请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isCollecting: false });
    }

    this.checkUnCollectedRewards(); // 添加这一行
  },

  showConditions() {
    // 删除整个函数
  },

  // 显示绑定邮箱弹窗
  showBindEmail() {
    this.setData({
      showBindEmailModal: true,
      emailInfo: {
        email: '',
        verifyCode: '',
        codeSent: false,
        countdown: 60
      }
    });
  },

  // 隐藏绑定邮箱弹窗
  hideBindEmail() {
    this.setData({
      showBindEmailModal: false
    });
  },

  // 处理邮箱输入
  handleEmailInput(e) {
    this.setData({
      'emailInfo.email': e.detail.value
    });
  },

  // 处理验证码输入
  handleVerifyCodeInput(e) {
    this.setData({
      'emailInfo.verifyCode': e.detail.value
    });
  },

  // 发送验证码
  async sendVerifyCode() {
    try {
      // 检查是否在倒计时中
      if (this.data.emailInfo.codeSent) {
        return;
      }

      const email = this.data.emailInfo.email;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        wx.showToast({
          title: '请输入有效的邮箱地址',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '发送中...',
        mask: true
      });

      const sendRequest = () => {
        return new Promise((resolve, reject) => {
          wx.cloud.callFunction({
            name: 'sendVerifyCode',
            data: { email }
          })
            .then(res => {
              console.log('API Response:', res.result);
              if (res.result.status === 'success') {
                resolve(res.result);
              } else {
                reject(new Error(res.result.message || '发送失败'));
              }
            })
            .catch(err => {
              reject(err);
            });
        });
      };

      await sendRequest();

      // 发送成功后设置倒计时
      this.setData({
        'emailInfo.codeSent': true,
        'emailInfo.countdown': 60
      });

      this.startCountdown();

      wx.showToast({
        title: '验证码已发送',
        icon: 'success'
      });

    } catch (err) {
      console.error('发送验证码失败:', err);
      wx.showToast({
        title: err.message || '发送失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 倒计时
  startCountdown() {
    const timer = setInterval(() => {
      const { countdown } = this.data.emailInfo;
      if (countdown <= 1) {
        clearInterval(timer);
        this.setData({
          'emailInfo.codeSent': false,
          'emailInfo.countdown': 60
        });
      } else {
        this.setData({
          'emailInfo.countdown': countdown - 1
        });
      }
    }, 1000);
  },

  // 绑定邮箱
  async bindEmail() {
    try {
      const { email, verifyCode } = this.data.emailInfo;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        wx.showToast({
          title: '请输入有效的邮箱地址',
          icon: 'none'
        });
        return;
      }

      if (!verifyCode || verifyCode.length !== 6) {
        wx.showToast({
          title: '请输入6位验证码',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({
        title: '绑定中...',
        mask: true
      });

      const result = await wx.cloud.callFunction({
        name: 'bindEmail',
        data: {
          email,
          verifyCode
        }
      });

      if (!result.result || result.result.status !== 'success') {
        throw new Error(result.result?.message || '绑定失败');
      }

      // 绑定成功，更新本地数据
      this.setData({
        'userInfo.email': email,
        showBindEmailModal: false,
        emailInfo: {
          email: '',
          verifyCode: '',
          codeSent: false,
          countdown: 0
        }
      });

      wx.showToast({
        title: '绑定成功',
        icon: 'success'
      });

    } catch (err) {
      console.error('绑定邮箱失败:', err);
      wx.showToast({
        title: err.message || '绑定失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 显示账号管理弹窗
  showAccountManagement() {
    this.setData({
      showAccountModal: true
    });
  },

  // 隐藏账号管理弹窗
  hideAccountManagement() {
    this.setData({
      showAccountModal: false
    });
  },
}); 