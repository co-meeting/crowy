require "csv"
langs = ["ja", "en", "es", "zh_CN"]
msgs = {}
langs.each{|lang|
  File::open("../src/conf/locale/#{lang}/LC_MESSAGES/django.po") {|f|
    status = 0 # 1=msgid, 2=msgstr
    msgid = ""
    msgstr = ""
    
    f.each{ |line|
      if /^msgid "(.*)"$/ =~ line
        status = 1
        msgid += $1
      elsif /^msgstr "(.*)"$/ =~ line
        status = 2
        msgstr += $1
      elsif /^"(.*)"$/ =~ line
        if status == 1
          msgid += $1
        elsif status == 2
          msgstr += $1
        end
      elsif line == "\n"
        if msgid.length > 0
          if not msgs[msgid]
            msgs[msgid] = {}
          end
          msgs[msgid][lang] = msgstr
        end
        msgid = ""
        msgstr = ""
        status = 0
      end
    }
    if msgid.length > 0
      if not msgs[msgid]
        msgs[msgid] = {}
      end
      msgs[msgid][lang] = msgstr
    end
    print "#{lang} #{msgs.length} messages was read.\n"
  }
}
CSV.open("po2csv.csv", 'w') do |writer|
  writer << ["key"]+langs
  msgs.each_pair{|msgid, msgs|
    record = [msgid]
    langs.each{|lang|
      record << msgs[lang]
    }
    writer << record
  }
end
print "end\n"