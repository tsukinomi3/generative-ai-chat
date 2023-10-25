var flag_speech = 0;
var flag_debug = false;
function text_chat_function(){
  var text = document.getElementById("input_text").value
  $('#result_text').val( '' );
  $('#result_texts').html( '<div class="balloon-l">' + text + '</div>' );
  $('#result_text').css( 'display', 'none' );
  AiChat( text );
}

function vr_function(){
  $('#start_btn').removeClass( 'btn-primary btn-warning' );
  $('#start_btn').addClass( 'btn-danger' );
  $('#start_btn').val( '<i class="fas fa-microphone"></i>' );

  //. https://developer.mozilla.org/ja/docs/Web/API/SpeechRecognition
  window.SpeechRecognition = window.SpeechRecognition || webkitSpeechRecognition;
  var recognition = new SpeechRecognition(); //webkitSpeechRecognition();
  recognition.lang = 'en'; //'ja';
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onaudiostart = function(){
    if( flag_debug ){ console.log( 'onaudiostart' ); }
  };
  recognition.onaudioend = function(){
    if( flag_debug ){ console.log( 'onaudioend' ); }
  };
  recognition.onspeechstart = function(){
    if( flag_debug ){ console.log( 'onspeechstart' ); }
    $('#status').val( 'Listening' );
  };
  recognition.onspeechend = function(){
    if( flag_debug ){ console.log( 'onspeechend' ); }
    $('#status').val( 'Stopping..' );
    ///vr_function();
  };

  recognition.onsoundstart = function(){
    if( flag_debug ){ console.log( 'onsoundstart' ); }
    //$('#status').val( 'Listening' );
  };
  recognition.onnomatch = function(){
    if( flag_debug ){ console.log( 'onnomatch' ); }
    $('#status').val( 'Try once more' );
  };
  recognition.onerror = function(){
    if( flag_debug ){ console.log( 'onerror' ); }
    $('#status').val( 'Error' );
    if( flag_speech == 0 ){
      vr_function();
    }
  };
  recognition.onsoundend = function(){
    if( flag_debug ){ console.log( 'onsoundend' ); }
    //$('#status').val( 'Stopping..' );
    ///vr_function();
  };

  recognition.onresult = function( event ){
    if( flag_debug ){ console.log( 'onresult' ); }
    var results = event.results;
    for( var i = event.resultIndex; i < results.length; i++ ){
      if( results[i].isFinal ){
        var text = results[i][0].transcript;
        $('#result_text').val( '' );
        $('#result_texts').html( '<div class="balloon-l">' + text + '</div>' );
        $('#result_text').css( 'display', 'none' );
        AiChat( text );
      }else{
        $('#result_text').css( 'display', 'block' );
        $('#result_text').val( "[Listening] " + results[i][0].transcript );
        flag_speech = 1;
      }
    }
  }
  flag_speech = 0;
  $('#status').val( "start" );
  recognition.start();
}
var conversation = "";
function AiChat( text ){
  $('#result_text').css( 'display', 'none' );
  var obj = getBusyOverlay( 'viewport', { color:'black', opacity:0.5, text:'thinking..', style:'text-decoration:blink;font-weight:bold;font-size:12px;color:white' } );
  //var ai = $('#ai-type').val();
  var model_id = $('#model_id').val();
  var ai = ( model_id == 'gpt-3.5-turbo-instruct' ) ? 'openai' : 'watsonx';
  $.ajax({
    type: 'POST',
    url: '/api/generate_text',
    data: { pc: conversation, input: text, ai: ai, model_id: model_id },
    success: function( result ){
      conversation += "[User] " + text + "\n";
      obj.remove();
      obj = null;
      //console.log( { result } );
      if( result && result.status ){
        var ai_text = result.generated_text;
        conversation += "[Friendly Assistant]" + ai_text + "\n";
        if( ai_text ){
          $('#result_texts').append( '<div class="balloon-r">' + ai_text + '</div>' );
          speechText( ai_text );
        }
      }
    },
    error: function( e0, e1, e2 ){
      $('#result_text').css( 'display', 'block' );
      obj.remove();
      obj = null;
      console.log( e0, e1, e2 );

      $('#start_btn').removeClass( 'btn-warning btn-danger' );
      $('#start_btn').addClass( 'btn-primary' );
      $('#start_btn').val( '<i class="fas fa-comment-alt"></i>' );
    }
  })
}

$(function(){
});

var uttr = null;

function speechText( text ){
  //$('#sample_speech').attr( 'src', '/api/t2s?text=' + text );
  //. https://web-creates.com/code/js-web-speech-api/
  if( 'speechSynthesis' in window ){
    var voices = window.speechSynthesis.getVoices();
    //console.log( { voices } );

    uttr = new SpeechSynthesisUtterance();
    uttr.text = text;
    uttr.lang = 'en-US'; //'ja-JP';

    $('#start_btn').removeClass( 'btn-primary btn-danger' );
    $('#start_btn').addClass( 'btn-warning' );
    $('#start_btn').val( '<i class="fas fa-comments"></i>' );

    window.speechSynthesis.speak( uttr );
    uttr.onend = speechEnd;
  }else{
    alert( 'このブラウザは Web Speech API に未対応です。')
  }
}

function speechEnd( evt ){
  if( flag_debug ){ console.log( 'speechEnd', {evt} ); }

  //. AI の発声後、すぐに聞き取りモードに入らせる場合
  //vr_function();  

  //. 再度ボタンを押させる場合
  $('#start_btn').removeClass( 'btn-warning btn-danger' );
  $('#start_btn').addClass( 'btn-primary' );
  $('#start_btn').val( '<i class="fas fa-comment-alt"></i>' );
}
