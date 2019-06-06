var config = exports;
///////////////////////�����Ϣ/////////////////////////////////////////////////
// ������
config.AUTHOR = "liva";
// ��ʼ�汾
config.FIRSTVERSION = "0.1.20120113";
// ��ǰ�汾
config.CURRENTVERSION = "1.0.20130219";
// ��ϵ����
config.EMAIL = "liva2008@qq.com";

///////////////////////����ѡ��/////////////////////////////////////////////////
// �����������˿�
config.PORT = 8000;

// ������Ϣ����,�������̽�������Ϊtrue,�������̽�������Ϊfalse
config.debug = true;
// ģ����ͼ�ͻ��˻�������Ⱦ����:������Ϊtrue,�ͻ���Ϊflase
config.temp = true;
// ��״̬����״̬����,����״̬����Session�Ựtrue����״̬�򲻿���false
config.status = false;
// Web�������Ƿ���CPU����
config.multi = false;

// ����Ӧ����ֻ��statics��uploadĿ¼�û��ɶ���̬Ŀ¼
config.getReadDir = function() {
	return /\/(upload|statics)\//i;
};

// �ỰʧЧʱ��(Ĭ��1��ʱ��)����
config.sessionExpiredTime = 3000;

// ����Ĭ�ϵ�['application', 'controller', 'action']
config.def = ['test', 'user', 'list'];

// ָ����׺�ļ��͹�������
config.expiresFile = {
    fileMatch: /gif|png|jpg|js|css/ig,
    maxAge: 60*60*24*365
};

// ����ѹ�����б�
config.compressFile = {
    match: /css|js|html/ig
};

// ����CACHE��С���ã���λΪ�ֽڣ���Ҫ���澲̬��Դ��ģ���ļ�
config.cacheSize = {
        MaxSingleSize: 1024*1024,	//�����ļ����ߴ�
        MaxTotalSize: 30*1024*1024 //�����ļ�Cache���ߴ�
};