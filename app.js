//. app.js
var express = require( 'express' ),
    axiosBase = require( 'axios' ),
    bodyParser = require( 'body-parser' ),
    ejs = require( 'ejs' ),
    formData = require( 'express-form-data' ),
    { Configuration, OpenAIApi } = require( 'openai' ),
    app = express();

require( 'dotenv' ).config();

// Test Prompts
var instruction = "[INST] <<SYS>>\nYou are a friendly, respectful and honest friend. Always answer as friendly as possible, while being safe. Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature. Also try to ask something for me, not try to help me.\n\nIf a question does not make any sense, or is not factually coherent, tell that you don't understand that well. If you don't know the answer to a question, please don't share false information.\n\nYou are an English speaker.\nIf you are asked a question in Japanese, please answer that you don't understand Japanese, and if you are asked a question in English, please answer in English.\n\nThe user is at beginner level of English, so please answer in easy and SHORT English sentence as much as possible. Also you don't speak so much.\n\nHave [Past Conversation] in your mind. Answer the bottom [User] section, but in 80 words.\n</SYS>>\n[/INST]\n"
var user_input = "[User] "
var answer_output = "\n[Friendly Assistant] \n"

//. env values
var settings_ai = 'AI' in process.env ? process.env.AI : 'watsonx'; 

var settings_watsonx_apikey = 'WATSONX_API_KEY' in process.env ? process.env.WATSONX_API_KEY : ''; 
var settings_watsonx_project_id = 'WATSONX_PROJECT_ID' in process.env ? process.env.WATSONX_PROJECT_ID : ''; 
var settings_watsonx_model_id = 'WATSONX_MODEL_ID' in process.env ? process.env.WATSONX_MODEL_ID : ''; 
var settings_openai_apikey = 'OPENAI_API_KEY' in process.env ? process.env.OPENAI_API_KEY : ''; 
var settings_openai_organization = 'OPENAI_ORGANIZATION' in process.env ? process.env.OPENAI_ORGANIZATION : '';
var settings_openai_model_id = 'OPENAI_MODEL_ID' in process.env ? process.env.OPENAI_MODEL_ID : ''; 

var settings_port = 'PORT' in process.env ? process.env.PORT : 8080; 
var settings_cors = 'CORS' in process.env ? process.env.CORS : ''; 

var openai = null;
var IGNORE_PHRASE = 5;  //. 結果の最初のフレーズがこの長さ以下だったら無視する

app.use( express.static( __dirname + '/public' ) );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( formData.parse( { autoClean: true } ) );
app.use( formData.format() );
app.use( express.Router() );
app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );

app.all( '/*', function( req, res, next ){
  if( settings_cors ){
    var origin = req.headers.origin;
    if( origin ){
      var cors = settings_cors.split( " " ).join( "" ).split( "," );

      //. cors = [ "*" ] への対応が必要
      if( cors.indexOf( '*' ) > -1 ){
        res.setHeader( 'Access-Control-Allow-Origin', '*' );
        res.setHeader( 'Access-Control-Allow-Methods', '*' );
        res.setHeader( 'Access-Control-Allow-Headers', '*' );
        res.setHeader( 'Vary', 'Origin' );
      }else{
        if( cors.indexOf( origin ) > -1 ){
          res.setHeader( 'Access-Control-Allow-Origin', origin );
          res.setHeader( 'Access-Control-Allow-Methods', '*' );
          res.setHeader( 'Access-Control-Allow-Headers', '*' );
          res.setHeader( 'Vary', 'Origin' );
        }
      }
    }
  }
  next();
});

app.get( '/', function( req, res ){
  res.render( 'index', {} );
});

app.get( '/text_chat', function( req, res ){
  res.render( 'text_chat', {} );
});

async function getAccessToken( apikey ){
  return new Promise( function( resolve, reject ){
    if( apikey ){
      var axios = axiosBase.create({
        baseURL: 'https://iam.cloud.ibm.com',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      var params = new URLSearchParams();
      params.append( 'grant_type', 'urn:ibm:params:oauth:grant-type:apikey' );
      params.append( 'apikey', apikey );

      axios.post( '/identity/token', params )
      .then( function( result ){
        if( result && result.data && result.data.access_token ){
          // console.log( 'access_token = ' + result.data.access_token );
          resolve( { status: true, access_token: result.data.access_token } );
        }else{
          resolve( { status: true, access_token: result.data.access_token } );
          resolve( { status: false, error: 'no access_token retrieved.' } );
        }
      }).catch( function( err ){
        console.log( {err} );
        resolve( { status: false, error: err } );
      });
    }else{
      resolve( { status: false, error: 'no apikey provided.' } );
    }
  });
}
async function generateText( access_token, project_id, model_id, pc, input, max_new_tokens ){
  return new Promise( function( resolve, reject ){
    if( access_token ){
      if( project_id && input && max_new_tokens ){
        var axios = axiosBase.create({
          baseURL: 'https://us-south.ml.cloud.ibm.com',
          responseType: 'json',
          headers: {
            'Authorization': 'Bearer ' + access_token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        var data = {
          'model_id': model_id,
          'input': instruction + "\n[Past Conversation]\n" + pc + "\n[/Past Conversation]\n" + user_input + input + answer_output,
          'parameters': {
            "decoding_method": "greedy",
            "max_new_tokens": max_new_tokens,
            "min_new_tokens": 0,
            "stop_sequences": [],
            "repetition_penalty": 1
          },
          'project_id': project_id 
        };

        axios.post( '/ml/v1-beta/generation/text?version=2023-05-29', data )
        .then( function( result ){
          //console.log( {result} );
          if( result && result.data && result.data.results ){
            resolve( { status: true, results: result.data.results } );
          }else{
            resolve( { status: false, error: 'no results found.' } );
          }
        }).catch( function( err ){
          console.log( {err} );
          resolve( { status: false, error: err } );
        });
      }else{
        resolve( { status: false, error: 'Parameter project_id, model_id, input, and/or max_new_tokens are not provided.' } );
      }
    }else{
      resolve( { status: false, error: 'access_token is null.' } );
    }
  });
}

const wait = ( ms ) => new Promise( ( res ) => setTimeout( res, ms ) );

const progressingCompletion = async ( option ) => {
	await wait( 10 );
  try{
    var result = await openai.createCompletion( option );
  	return {
      status: true,
		  result: result
  	};
  }catch( e ){
  	return {
      status: false,
		  result: e
  	};
  }
}

const callWithProgress = async ( fn, option, maxdepth = 7, depth = 0 ) => {
	const result = await fn( option );

	// check completion
	if( result.status ){
		// finished
		return result.result;
	}else{
		if( depth > maxdepth ){
			throw result;
		}
		await wait( Math.pow( 2, depth ) * 10 );
	
		return callWithProgress( fn, option, maxdepth, depth + 1 );
	}
}

const progressingChatCompletion = async ( option ) => {
	await wait( 10 );
  try{
    var result = await openai.createChatCompletion( option );
  	return {
      status: true,
		  result: result
  	};
  }catch( e ){
  	return {
      status: false,
		  result: e
  	};
  }
}

app.post( '/api/generate_text', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  console.log( req.body );

  var ai = req.body.ai ? req.body.ai : settings_ai;
  var input = req.body.input;
  var pc = req.body.pc; // 過去の会話 Past Conversation
  var max_new_tokens = ( req.body.max_new_tokens ? parseInt( req.body.max_new_tokens ) : 100 );

  try{
    switch( ai ){
    case 'watsonx':
      var apikey = ( req.body.apikey ? req.body.apikey : settings_watsonx_apikey );
      var project_id = ( req.body.project_id ? req.body.project_id : settings_watsonx_project_id );
      var model_id = ( req.body.model_id ? req.body.model_id : settings_watsonx_model_id );
      if( apikey && project_id && model_id && input && max_new_tokens ){
        var result0 = await getAccessToken( apikey );
        if( result0 && result0.status && result0.access_token ){
          var result = await generateText( result0.access_token, project_id, model_id, pc, input, max_new_tokens );
          if( result && result.status ){
            var results = result.results;
            if( results && results[0] && results[0].generated_text ){
              var generated_text = results[0].generated_text;
              var tmp = generated_text.split( '\\n' );
              if( tmp.length > 1 ){
                generated_text = tmp[0];
              }

              res.write( JSON.stringify( { status: true, generated_text: generated_text }, null, 2 ) );
              res.end();
            }else{
              res.status( 400 )
              res.write( JSON.stringify( { status: false, error: 'no generated_text found.' }, null, 2 ) );
              res.end();
            }
          }else{
            res.status( 400 )
            res.write( JSON.stringify( { status: false, error: result.err }, null, 2 ) );
            res.end();
          }
        }else{
          res.status( 400 )
          res.write( JSON.stringify( { status: false, error: result0.error }, null, 2 ) );
          res.end();
        }
      }else{
        res.status( 400 )
        res.write( JSON.stringify( { status: false, error: 'Parameter apikey, project_id, model_id, input, and max_new_tokens are all mandatory.' }, null, 2 ) );
        res.end();
      }

      break;
    case 'openai':
      var apikey = ( req.body.apikey ? req.body.apikey : settings_openai_apikey );
      var organization = ( req.body.organization ? req.body.organization : settings_openai_organization );
      var configuration = new Configuration({ apiKey: apikey, organization: organization });
      openai = new OpenAIApi( configuration );

      //var model = ( req.body.model ? req.body.model : 'text-davinci-003' );
      var model_id = ( req.body.model_id ? req.body.model_id : settings_openai_model_id );
      //var prompt = req.body.prompt;

      var option = {
        model: model_id,
        prompt: input,
        max_tokens: max_new_tokens
      };
      if( req.body.temperature ){
        option.temperature = parseFloat( req.body.temperature );
      }
      if( req.body.top_p ){
        option.top_p = parseFloat( req.body.top_p );
      }
      if( req.body.n ){
        option.n = parseInt( req.body.n );
      }

      try{
        //var result = await openai.createCompletion( option );
        var result = await callWithProgress( progressingCompletion, option, 5 ); //. #1
        var answer = result.data.choices[0].text;

        //. 最初の "\n\n" 以降が正しい回答？
        var tmp = answer.split( "\n\n" );
        if( tmp.length > 1 && tmp[0].length < IGNORE_PHRASE ){
          tmp.shift();
          answer = tmp.join( "\n\n" );
        }

        res.write( JSON.stringify( { status: true, generated_text: answer }, null, 2 ) );
        res.end();
      }catch( err ){
        //console.log( {err} );
        //console.log( err.result.response );
        var status_code = ( err.response && err.response.status ? err.response.status : ( err.result && err.result.response && err.result.response.status ? err.result.response.status : 400 ) ); //. #1
        var status_text = ( err.response && err.response.statusText ? err.response.statusText : ( err.result && err.result.response && err.result.response.statusText ? err.result.response.statusText : 'unknown error' ) );
        if( err.result && err.result.response && err.result.response.data && err.result.response.data.error && err.result.response.data.error.message ){
          status_text += '. ' + err.result.response.data.error.message;
        }
        res.status( status_code )
        res.write( JSON.stringify( { status: false, error: status_text }, null, 2 ) );
        res.end();
      }

      break;
    }
  }catch( err ){
    console.log( {err} );
    res.status( 400 )
    res.write( JSON.stringify( { status: false, error: err }, null, 2 ) );
    res.end();
  }
});

app.listen( settings_port );
console.log( "server starting on " + settings_port + " ..." );
